const Purchase = require("../models/Purchase");
// const Stock = require("../models/Stock"); // Legacy
const Account = require("../models/Account");
const ItemVariant = require("../models/ItemVariantSchema");
const Transaction = require("../models/Transaction");
const mongoose = require("mongoose");
const SerializedStock = require("../models/SerializedStock");
const NonSerializedStock = require("../models/NonSerializedStock");
const Item = require("../models/Items");
const StockLedger = require("../models/StockLedger");
const AuditLog = require("../models/AuditLog");
const Attribute = require("../models/Attribute");
const Supplier = require("../models/Supplier");
const Customer = require("../models/Customer");

// Create a new purchase
exports.createPurchase_old = async (req, res) => {
  try {
    const purchaseData = req.body;

    // Generate unique batch number for each purchased item
    purchaseData.purchasedItems = purchaseData.purchasedItems.map((item) => ({
      ...item,
      batch_number: `BATCH-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 8)
        .toUpperCase()}`,
    }));

    // Save the purchase
    const purchase = new Purchase(purchaseData);
    await purchase.save();

    // Update Stock
    for (const item of purchase.purchasedItems) {
      // Find all existing stock entries for this item_id
      const existingStockEntries = await Stock.find({ item_id: item.item_id });

      // Sum up the available quantities to get the total stock before this purchase
      const beforePurchaseAvailable_qty = existingStockEntries.reduce(
        (sum, stock) => sum + stock.available_qty,
        0
      );

      // Create a new stock entry for the new batch
      await Stock.create({
        item_id: item.item_id,
        purchase_id: purchase._id,
        batch_number: item.batch_number,
        purchase_date: purchase.purchaseDate,
        purchase_qty: item.purchaseQty,
        available_qty: item.purchaseQty, // New batch's available quantity starts as the purchase quantity
        beforePurchaseAvailable_qty: beforePurchaseAvailable_qty, // Total available stock before this purchase
        unit_cost: item.unitCost,
        selling_price: item.sellingPrice,
        unit: item.unit,
      });
    }

    res
      .status(201)
      .json({ message: "Purchase created successfully", purchase });
  } catch (error) {
    res.status(500).json({ message: "Error creating purchase", error });
  }
};

// Create a new purchase
exports.createPurchase1 = async (req, res) => {
  //const session = await mongoose.startSession();
  // session.startTransaction();
  //console.log("create purchase api called");
  console.log("🔥 createPurchase controller START", new Date().toISOString());

  try {
    const purchaseData = req.body;
    let variant;
    // STEP 1: Process items to find or create variants BEFORE saving the purchase
    for (const item of purchaseData.purchasedItems) {
      if (item.isSerialized && item.variantAttributes) {
        // Find the base item to get its name
        const baseItem = await Item.findById(item.item_id);
        if (!baseItem) {
          throw new Error(`Item with ID ${item.item_id} not found.`);
        }

        if (!item.sellingPrice)
          throw new Error(
            `Item with sellingPrice: ${item.sellingPrice} not found.`
          );

        // Create a consistent, searchable name for the variant
        const allAttributes = await Attribute.find().lean();
        const attrOrderMap = allAttributes.reduce((acc, curr) => {
          acc[curr.key.toUpperCase()] = curr.order;
          return acc;
        }, {});

        const sortedAttrs = (item.variantAttributes || [])
          .filter(a => a && a.value)
          .sort((a, b) => {
            const orderA = attrOrderMap[a.key.toUpperCase()] ?? 99;
            const orderB = attrOrderMap[b.key.toUpperCase()] ?? 99;
            return orderA - orderB;
          });

        const attributesString = sortedAttrs
          .map((attr) => attr.value.toUpperCase())
          .join("-");

        const variantName = attributesString
          ? `${baseItem.itemName} - ${attributesString}`.trim()
          : baseItem.itemName.trim();

        console.log("item.itemName", item.itemName);
        console.log("variantName", variantName);
        // Use findOneAndUpdate with upsert to find an existing variant or create a new one
        variant = await ItemVariant.findOneAndUpdate(
          {
            item_id: item.item_id,
            variantName: variantName, // Use the unique name to find the variant
          },
          {
            $setOnInsert: {
              item_id: item.item_id,
              variantAttributes: item.variantAttributes,
              variantName: variantName,
              defaultSellingPrice: item.sellingPrice, // Set initial default price
              lastUnitCost: item.unitCost, // Set initial cost
            },
          },
          {
            upsert: true, // Create the document if it doesn't exist
            new: true, // Return the new or updated document
            // session // Pass session if using transactions
          }
        );

        console.log("founded varient ", variant);
        // console.log("variant found/created: ", variant);
        // Attach the found/created variant's ID to the item for later use
        item.variant_id = variant._id;

        // console.log("item after variant assignment: ", item.variant_id);
      }
    }

    // console.log("all items after variant processing: ", purchaseData.purchasedItems);
    const batchNo = `BATCH-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;
    // Generate unique batch number for each purchased item

    // console.log(purchaseData.purchasedItems.map(x=> x.serializedItems))
    // return

    purchaseData.purchasedItems = purchaseData.purchasedItems.map((item) => {
      // If the item is serialized, also assign batch number to each serialized item

      console.log("item.variant_id ", item.variant_id);
      if (item.isSerialized && item.serializedItems) {
        item.serializedItems = item.serializedItems.map((itm) => ({
          ...itm,
          variant_id: item.variant_id,

          batch_number: batchNo,
        }));
      }

      return {
        ...item,
        variant_id: item.variant_id,
        batch_number: batchNo,
      };
    });

    // STEP 2: Save the purchase with the enriched item data
    //const purchase = new Purchase(purchaseData);
    //await purchase.save();
    console.log(
      "purchaseData ",
      purchaseData.purchasedItems.map((x) => x.serializedItems)
    );

    const purchase = await Purchase.create(purchaseData);
    // console.log("\n\n purchased saved success ", purchase);
    // STEP 3: Update Stock using the now-saved purchase and variant IDs

    // STEP 3: Update Stock using the now-saved purchase and variant IDs
    for (const item of purchase.purchasedItems) {
      if (item.isSerialized) {
        // Handle serialized items
        if (item.serializedItems && item.serializedItems.length > 0) {
          for (const serializedUnit of item.serializedItems) {
            // Create a stock entry for each unique physical unit
            console.log("serializedUnit ", serializedUnit);
            await SerializedStock.create(
              [
                {
                  item_id: item.item_id,
                  variant_id: serializedUnit.variant_id, // ✅ Link to the variant
                  purchase_id: purchase._id,
                  serialNumber: serializedUnit.serialNumber,
                  batch_number: item.batch_number,
                  purchaseDate: purchase.purchaseDate,
                  unitCost: serializedUnit.unitCost,
                  sellingPrice: serializedUnit.sellingPrice,
                  status: "Available",

                  // ✅ Save unit-specific data
                  batteryHealth: serializedUnit.batteryHealth ?? serializedUnit.battery_health,
                  condition: serializedUnit.condition,
                },
              ]
              // { session } // Pass session if using transactions
            );
          }
        }
      } else {
        // Handle non-serialized items (Backward compatibility)
        const existingStockEntries = await NonSerializedStock.find({
          item_id: item.item_id,
        });
        const beforePurchaseAvailable_qty = existingStockEntries.reduce(
          (sum, stock) => sum + stock.availableQty,
          0
        );

        await NonSerializedStock.create(
          [
            {
              item_id: item.item_id,
              variant_id: item.variant_id, // ✅ Link to the variant
              purchase_id: purchase._id,
              batch_number: item.batch_number,
              purchaseDate: purchase.purchaseDate,
              purchaseQty: item.purchaseQty,
              availableQty: item.purchaseQty,
              beforePurchaseAvailableQty: beforePurchaseAvailable_qty,
              unitCost: item.unitCost,
              sellingPrice: item.sellingPrice,
              unit: item.unit,
            },
          ]
          // { session } // Pass session if using transactions
        );
      }
    }
    // STEP 4: Update Supplier Account

    // Find the supplier account
    const supplierAccount = await Account.findOne({
      account_owner_type: "Supplier",
      related_party_id: purchase.supplier,
    });

    if (!supplierAccount) {
      throw new Error("Supplier account not found.");
    }

    // Calculate the new due amount by adding the current grand total to the existing balance
    const newDueAmount = supplierAccount.balance - purchase.grand_total; // Subtract purchase grand total from existing balance

    // Update the supplier account balance with the new due amount
    supplierAccount.balance = newDueAmount;

    await supplierAccount.save();

    // Record the transaction
    const transaction = new Transaction({
      account_id: supplierAccount._id,
      amount: purchase.grand_total * -1,
      transaction_type: "Withdrawal",
      reason: `Purchase: ${purchase.referenceNumber}`,
      transaction_date: new Date(),
      balance_after_transaction: supplierAccount.balance,
    });

    await transaction.save();

    //await session.commitTransaction();
    //session.endSession();

    res
      .status(201)
      .json({ message: "Purchase created successfully", purchase });
  } catch (error) {
    //await session.abortTransaction();
    //session.endSession();
    console.error("🔥 createPurchase controller ERROR", error);
    console.error("Error creating purchase:", error);
    res.status(500).json({ message: "Error creating purchase", error });
  }
};

exports.createPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const data = req.body;

    console.log("🔥 createPurchase DATA:", data);

    // Force status to "Pending Verification" for stock integrity protocol
    data.purchase_status = "Pending Verification";

    /* ------------------------------------------------
   1. VALIDATE SUPPLIER/CUSTOMER + INPUT DATA
--------------------------------------------------*/
    let accountOwnerType = "Supplier";
    let relatedPartyId = data.supplier;

    if (data.purchase_type === "Trade-In") {
      accountOwnerType = "Customer";
      relatedPartyId = data.customer;
      if (!relatedPartyId) throw new Error("Customer ID is required for Trade-In.");
    } else {
      if (!relatedPartyId) throw new Error("Supplier ID is required for regular Purchase.");
    }

    const partyAcc = await Account.findOne({
      account_owner_type: accountOwnerType,
      related_party_id: relatedPartyId,
    }).session(session);

    if (!partyAcc) throw new Error(`${accountOwnerType} account not found.`);

    if (!Array.isArray(data.purchasedItems) || data.purchasedItems.length === 0)
      throw new Error("No purchase items provided.");

    /* ------------------------------------------------
   2. RESOLVE VARIANTS
--------------------------------------------------*/
    const allAttributes = await Attribute.find().session(session).lean();
    const attrOrderMap = allAttributes.reduce((acc, curr) => {
      acc[curr.key.toUpperCase()] = curr.order;
      return acc;
    }, {});

    for (const item of data.purchasedItems) {
      if (item.isSerialized && item.variantAttributes) {
        const baseItem = await Item.findById(item.item_id).session(session);
        if (!baseItem) throw new Error("Base item not found.");

        const sortedAttrs = (item.variantAttributes || [])
          .filter(a => a && a.value)
          .sort((a, b) => {
            const orderA = attrOrderMap[a.key.toUpperCase()] ?? 99;
            const orderB = attrOrderMap[b.key.toUpperCase()] ?? 99;
            return orderA - orderB;
          });

        const attributesString = sortedAttrs
          .map((a) => a.value.toUpperCase())
          .join("-");

        const variantName = attributesString
          ? `${baseItem.itemName} - ${attributesString}`.trim()
          : baseItem.itemName.trim();

        const variant = await ItemVariant.findOneAndUpdate(
          { item_id: item.item_id, variantName },
          {
            $setOnInsert: {
              item_id: item.item_id,
              variantAttributes: item.variantAttributes,
              variantName,
              defaultSellingPrice: item.sellingPrice,
              lastUnitCost: item.unitCost,
            },
          },
          { new: true, upsert: true, session }
        );

        item.variant_id = variant._id;
      }
    }

    /* ------------------------------------------------
   3. ASSIGN BATCH NUMBER
--------------------------------------------------*/
    const batchNo = `BATCH-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)}`;

    data.purchasedItems = data.purchasedItems.map((i) => {
      if (i.isSerialized && i.serializedItems) {
        i.serializedItems = i.serializedItems.map((s) => ({
          ...s,
          batch_number: batchNo,
          variant_id: i.variant_id,
        }));
      }
      return { ...i, batch_number: batchNo };
    });

    /* ------------------------------------------------
   4. CREATE PURCHASE DOCUMENT
--------------------------------------------------*/
    const purchase = await Purchase.create([data], { session });
    const purchaseDoc = purchase[0];

    /* ------------------------------------------------
   5. UPDATE STOCK + STOCK LEDGER
--------------------------------------------------*/
    for (const item of purchaseDoc.purchasedItems) {
      if (item.isSerialized) {
        // Serialized stock entries
        for (const unit of item.serializedItems) {
          await SerializedStock.create(
            [
              {
                item_id: item.item_id,
                variant_id: unit.variant_id,
                purchase_id: purchaseDoc._id,
                purchaseDate: purchaseDoc.purchaseDate,
                serialNumber: unit.serialNumber,
                batch_number: batchNo,
                unitCost: unit.unitCost,
                sellingPrice: unit.sellingPrice,
                status: "Incoming",
                condition: unit.condition || "Brand New",
              },
            ],
            { session }
          );

          // await StockLedger.create(
          //   [
          //     {
          //       item_id: item.item_id,
          //       variant_id: unit.variant_id,
          //       purchase_id: purchaseDoc._id,
          //       movementType: "Purchase-In",
          //       serialNumbers: [unit.serialNumber],
          //       unitCost: unit.unitCost,
          //       openingQty: 0,
          //       closingQty: 1,
          //       batch_number: batchNo,
          //     },
          //   ],
          //   { session }
          // );

          // Ledger entry
          const previousLedger = await StockLedger.findOne({
            item_id: item.item_id,
          })
            .sort({ createdAt: -1 })
            .session(session)
            .lean();

          const ledgerEntry = exports.createStockLedgerEntry({
            item_id: item.item_id,
            variant_id: item.variant_id,
            purchase_id: purchase[0]._id,
            serialNumber: unit.serialNumber,
            movementType: "Purchase-In",
            qty: 1,
            previousLedger,
            batch_number: item.batch_number,
            unitCost: item.unitCost,
            sellingPrice: item.sellingPrice,
            memo: `Purchase: ${purchase[0].referenceNumber}`,
          });

          await StockLedger.create([ledgerEntry], { session });
        }
      } else {
        // Non-serialized
        const existing = await NonSerializedStock.find({
          item_id: item.item_id,
          variant_id: item.variant_id || null,
        }).session(session);

        const opening = existing.reduce((s, e) => s + e.availableQty, 0);

        await NonSerializedStock.create(
          [
            {
              item_id: item.item_id,
              variant_id: item.variant_id || null, // ✅ Added variant support
              purchase_id: purchaseDoc._id,
              purchaseDate: purchaseDoc.purchaseDate,

              purchaseQty: item.purchaseQty,
              availableQty: item.purchaseQty,
              beforePurchaseAvailableQty: opening,
              unitCost: item.unitCost,
              sellingPrice: item.sellingPrice,
              batch_number: batchNo,
              status: "Incoming",
              condition: item.condition || "Brand New",
            },
          ],
          { session }
        );

        // await StockLedger.create(
        //   [
        //     {
        //       item_id: item.item_id,
        //       purchase_id: purchaseDoc._id,
        //       movementType: "IN",
        //       quantity: item.purchaseQty,
        //       unitCost: item.unitCost,
        //       openingQty: opening,
        //       closingQty: opening + item.purchaseQty,
        //       batch_number: batchNo,
        //     },
        //   ],
        //   { session }
        // );
        // Ledger
        const previousLedger = await StockLedger.findOne({
          item_id: item.item_id,
          variant_id: item.variant_id || null,
        })
          .sort({ createdAt: -1 })
          .session(session)
          .lean();

        const ledgerEntry = exports.createStockLedgerEntry({
          item_id: item.item_id,
          variant_id: item.variant_id || null,
          movementType: "Purchase-In",
          qty: item.purchaseQty,
          previousLedger,
          purchase_id: purchase[0]._id,
          batch_number: item.batch_number,
          unitCost: item.unitCost,
          sellingPrice: item.sellingPrice,
          memo: `Purchase: ${purchase[0].referenceNumber}`,
        });

        await StockLedger.create([ledgerEntry], { session });
      }
    }

    /* ------------------------------------------------
    6. SUPPLIER ACCOUNT UPDATE (DEFERRED)
    --------------------------------------------------*/
    // Finance update deferred to verification step



    /* ------------------------------------------------
   7. AUDIT LOG
--------------------------------------------------*/
    await AuditLog.create(
      [
        {
          action: "PURCHASE_CREATED",
          purchase_id: purchaseDoc._id,
          performedBy: req.user?._id,
          before: null,
          after: purchaseDoc,
          description: `Purchase ${purchaseDoc.referenceNumber} created.`,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    res
      .status(201)
      .json({ message: "Purchase created", purchase: purchaseDoc });
  } catch (err) {
    await session.abortTransaction();
    console.error("🔥 createPurchase ERROR:", err);

    if (err.code === 11000) {
      return res.status(409).json({
        message: `Duplicate value not allowed: ${JSON.stringify(err.keyValue)}`,
      });
    }

    if (err.name === "ValidationError") {
      const formattedErrors = [];

      for (const field in err.errors) {
        const e = err.errors[field];

        formattedErrors.push({
          field: e.path,
          message: e.message,
          kind: e.kind,
          value: e.value,
        });
      }

      const readableMessage = formattedErrors
        .map((e) => `${e.field}: ${e.message}`)
        .join("; ");

      return res.status(400).json({
        success: false,
        status: "validation_error",
        message: readableMessage,
        details: formattedErrors,
        ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
      });
    }

    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
};

// Get all purchases
exports.getAllPurchases = async (req, res) => {
  try {
    const purchases = await Purchase.find()
      .sort({ _id: -1 })
      .populate("supplier", "business_name")
      .populate("customer", "first_name last_name customer_id nic_number")
      .populate("purchasedItems.item_id")
      .populate("purchasedItems.variant_id");
    res.status(200).json(purchases);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving purchases", error });
  }
};

// Search purchases by S/N, IMEI, Barcode, Ref, or Supplier/Customer details
exports.searchPurchases = async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) return res.json([]);

    // 1. Find by Serial Number / IMEI in SerializedStock
    const serializedStock = await SerializedStock.find({
      serialNumber: { $regex: query, $options: "i" }
    }, 'purchase_id').lean();
    const purchaseIdsFromSerials = serializedStock.map(s => s.purchase_id);

    // 2. Find by Barcode in Items
    const items = await Item.find({
      barcode: { $regex: query, $options: "i" }
    }, '_id').lean();
    const itemIds = items.map(i => i._id);

    // 3. Find by Supplier Details (Name, Phone, ID)
    const suppliers = await Supplier.find({
      $or: [
        { business_name: { $regex: query, $options: "i" } },
        { "contact_info.contact_number": { $regex: query, $options: "i" } },
        { supplier_id: { $regex: query, $options: "i" } }
      ]
    }, '_id').lean();
    const supplierIds = suppliers.map(s => s._id);

    // 4. Find by Customer Details (for Trade-Ins)
    const customers = await Customer.find({
      $or: [
        { first_name: { $regex: query, $options: "i" } },
        { last_name: { $regex: query, $options: "i" } },
        { phone_number: { $regex: query, $options: "i" } },
        { customer_id: { $regex: query, $options: "i" } }
      ]
    }, '_id').lean();
    const customerIds = customers.map(c => c._id);

    // 5. Perform the main search in Purchase
    const purchases = await Purchase.find({
      $or: [
        { referenceNumber: { $regex: query, $options: "i" } },
        { _id: { $in: purchaseIdsFromSerials } },
        { "purchasedItems.item_id": { $in: itemIds } },
        { supplier: { $in: supplierIds } },
        { customer: { $in: customerIds } }
      ]
    })
      .populate("supplier", "business_name")
      .populate("customer", "first_name last_name customer_id phone_number")
      .populate("purchasedItems.item_id", "itemName barcode")
      .sort({ purchaseDate: -1 })
      .limit(50);

    res.json(purchases);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({ message: "Error searching purchases" });
  }
};

// Get a single purchase by ID
exports.getPurchaseById = async (req, res) => {
  try {
    const { id } = req.params;
    const purchase = await Purchase.findById(id)
      .populate("supplier")
      .populate("customer")
      .populate("purchasedItems.item_id")
      .populate("purchasedItems.variant_id");
    if (!purchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    res.status(200).json(purchase);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving purchase", error });
  }
};

/**
 * verifyPurchasePhysical:
 * Confirms that the physical stock matches the purchase order.
 * Updates supplier account and logs discrepancies if necessary.
 */
exports.verifyPurchasePhysical = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { id } = req.params;
    const { actual_grand_total, verification_notes } = req.body;

    const purchase = await Purchase.findById(id).session(session);
    if (!purchase) throw new Error("Purchase not found");
    if (purchase.purchase_status !== "Pending Verification") {
      throw new Error(`Purchase cannot be verified. Current status: ${purchase.purchase_status}`);
    }

    let accountOwnerType = "Supplier";
    let relatedPartyId = purchase.supplier;

    if (purchase.purchase_type === "Trade-In") {
      accountOwnerType = "Customer";
      relatedPartyId = purchase.customer;
    }

    const partyAcc = await Account.findOne({
      account_owner_type: accountOwnerType,
      related_party_id: relatedPartyId,
    }).session(session);

    if (!partyAcc) throw new Error(`${accountOwnerType} account not found`);

    const expectedTotal = purchase.grand_total;
    const discrepancy = actual_grand_total - expectedTotal;

    // Update Purchase Record
    purchase.purchase_status = discrepancy === 0 ? "Received" : "Discrepancy";
    purchase.verification_date = new Date();
    purchase.verification_notes = verification_notes;
    purchase.discrepancy_details = {
      expected_grand_total: expectedTotal,
      actual_grand_total: actual_grand_total,
      mismatch_reason: verification_notes
    };

    await purchase.save({ session });


    // --- LOG LEDGER MOVEMENTS (Unlocking from Pipeline) ---
    for (const item of purchase.purchasedItems) {
      if (item.isSerialized) {
        for (const unit of (item.serializedItems || [])) {
          const previousLedger = await StockLedger.findOne({ item_id: item.item_id })
            .sort({ createdAt: -1 })
            .session(session)
            .lean();

          const ledgerEntry = exports.createStockLedgerEntry({
            item_id: item.item_id,
            variant_id: item.variant_id,
            purchase_id: purchase._id,
            serialNumber: unit.serialNumber,
            movementType: "Purchase-In",
            qty: 1,
            previousLedger,
            batch_number: item.batch_number,
            unitCost: unit.unitCost,
            sellingPrice: unit.sellingPrice,
            memo: `Verified Purchase: ${purchase.referenceNumber}`,
          });
          await StockLedger.create([ledgerEntry], { session });
        }
      } else {
        const previousLedger = await StockLedger.findOne({
          item_id: item.item_id,
          variant_id: item.variant_id || null,
        })
          .sort({ createdAt: -1 })
          .session(session)
          .lean();

        const ledgerEntry = exports.createStockLedgerEntry({
          item_id: item.item_id,
          variant_id: item.variant_id,
          purchase_id: purchase._id,
          qty: item.purchaseQty,
          movementType: "Purchase-In",
          previousLedger,
          batch_number: item.batch_number,
          unitCost: item.unitCost,
          sellingPrice: item.sellingPrice,
          memo: `Verified Purchase: ${purchase.referenceNumber}`,
        });
        await StockLedger.create([ledgerEntry], { session });
      }
    }

    // Update Stock Status to Available based on Verification
    // Assuming verification accepts all for now, or we can implement detailed item-level verification later
    // For this pass, we unlock ALL stock related to this purchase
    await SerializedStock.updateMany(
      { purchase_id: purchase._id },
      { $set: { status: "Available" } },
      { session }
    );

    await NonSerializedStock.updateMany(
      { purchase_id: purchase._id },
      { $set: { status: "Available" } },
      { session }
    );

    // Update Finance Ledger (Actual Received Amount)
    partyAcc.balance -= actual_grand_total;
    await partyAcc.save({ session });

    await Transaction.create(
      [
        {
          account_id: partyAcc._id,
          amount: actual_grand_total * -1,
          transaction_type: "Withdrawal",
          reason: `Verified ${purchase.purchase_type}: ${purchase.referenceNumber} ${discrepancy !== 0 ? "(Discrepancy Logged)" : ""}`,
          balance_after_transaction: partyAcc.balance,
        },
      ],
      { session }
    );

    // If discrepancy, log to DiscrepancyLog
    if (discrepancy !== 0) {
      const DiscrepancyLog = require("../models/DiscrepancyLog");
      await DiscrepancyLog.create([
        {
          type: "Purchase",
          category: discrepancy < 0 ? "Short Shipment" : "Over Shipment",
          reference_id: purchase._id,
          field_name: "grand_total",
          expected_value: expectedTotal,
          actual_value: actual_grand_total,
          delta: discrepancy,
          reason: verification_notes,
          user_id: req.user?._id
        }
      ], { session });
    }

    await session.commitTransaction();
    res.status(200).json({
      message: "Purchase verified and stock finalized.",
      purchase,
      discrepancy
    });

  } catch (err) {
    await session.abortTransaction();
    console.error("🔥 verifyPurchasePhysical ERROR:", err);
    res.status(500).json({ error: err.message });
  } finally {
    session.endSession();
  }
};

exports.getDuePurchaseBySupplierId = async (req, res) => {
  try {
    const { id } = req.params;
    const purchases = await Purchase.find({
      supplier: id,
      payment_due_amount: { $gt: 0 },
    })
      .populate("supplier")
      .populate("purchasedItems.item_id")
      .sort({
        _id: -1,
      });
    if (purchases.length === 0) {
      return res.status(404).json({ message: "Purchase not found" });
    }
    res.status(200).json(purchases);
  } catch (error) {
    res.status(500).json({ message: "Error retrieving purchase", error });
  }
};

exports.updatePurchaseSellingPriceOld = async (req, res) => {
  try {
    // Validate request parameters
    const { purchaseId } = req.params;
    if (!purchaseId) {
      return res.status(400).json({ message: "Purchase ID is required" });
    }

    // Validate request body
    const { purchasedItems } = req.body;
    if (!Array.isArray(purchasedItems) || purchasedItems.length === 0) {
      return res
        .status(400)
        .json({ message: "Updated purchase items are required" });
    }

    // Find existing purchase
    const existingPurchase = await Purchase.findById(purchaseId);
    if (!existingPurchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    // Update existing purchase
    existingPurchase.purchasedItems = purchasedItems;
    await existingPurchase.save();

    // Fetch all relevant serialized and non-serialized stocks at once
    const serializedItemIds = purchasedItems
      .filter((item) => item.isSerialized)
      .map((item) => item.item_id._id);

    const nonSerializedItemIds = purchasedItems
      .filter((item) => !item.isSerialized)
      .map((item) => item.item_id._id);

    const existingSerializedStocks = await SerializedStock.find({
      item_id: { $in: serializedItemIds },
      purchase_id: existingPurchase._id,
    });

    const existingNonSerializedStocks = await NonSerializedStock.find({
      item_id: { $in: nonSerializedItemIds },
      purchase_id: existingPurchase._id,
    });

    // Convert fetched stocks into maps for fast lookup
    const serializedStockMap = new Map(
      existingSerializedStocks.map((stock) => [stock.serialNumber, stock])
    );

    const nonSerializedStockMap = new Map(
      existingNonSerializedStocks.map((stock) => [
        stock.item_id.toString(),
        stock,
      ])
    );

    // Process updates for both serialized and non-serialized stock
    const updatePromises = [];

    for (const item of purchasedItems) {
      if (item.isSerialized) {
        for (const serializedItem of item.serializedItems) {
          const existingSerializedStock = serializedStockMap.get(
            serializedItem.serialNumber
          );

          if (existingSerializedStock) {
            // Check if serial number changed
            if (
              existingSerializedStock.serialNumber !==
              serializedItem.serialNumber
            ) {
              const serialExists = serializedStockMap.has(
                serializedItem.serialNumber
              );
              if (serialExists) {
                console.warn(
                  `Duplicate serial number detected: ${serializedItem.serialNumber}`
                );
                continue; // Skip update
              }
              existingSerializedStock.serialNumber =
                serializedItem.serialNumber;
            }

            // Update selling price
            existingSerializedStock.sellingPrice = serializedItem.sellingPrice;
            updatePromises.push(existingSerializedStock.save());
          } else {
            console.warn(
              `Serialized stock not found for item ${item.item_id.itemName}`
            );
          }
        }
      } else {
        const existingNonSerializedStock = nonSerializedStockMap.get(
          item.item_id.toString()
        );

        if (existingNonSerializedStock) {
          existingNonSerializedStock.sellingPrice = item.sellingPrice;
          updatePromises.push(existingNonSerializedStock.save());
        } else {
          console.warn(
            `Non-serialized stock not found for item ${item.item_id.itemName}`
          );
        }
      }
    }

    // Execute all update operations in parallel
    await Promise.all(updatePromises);

    res.status(200).json({
      message: "Purchase updated successfully",
      purchase: existingPurchase,
    });
  } catch (error) {
    console.error("Error updating purchase:", error);
    res
      .status(500)
      .json({
        message: error?.message || "Error updating purchase",
        error: error.message,
      });
  }
};

/**
 * Helper: normalize incoming item_id which can be either populated object or string/ObjectId
 */
function normalizeId(maybeObj) {
  if (!maybeObj) return null;
  if (typeof maybeObj === "string") return maybeObj;
  if (maybeObj._id) return String(maybeObj._id);
  // If it's already an ObjectId
  if (maybeObj instanceof mongoose.Types.ObjectId) return String(maybeObj);
  return String(maybeObj);
}

/**
 * Helper: create a stock ledger entry (Correction or Price change)
 * We store qty = 0 for price-only corrections to preserve valuation history.
 */
async function createLedgerEntry({ session, doc }) {
  // doc should follow StockLedger schema
  try {
    await StockLedger.create([doc], { session });
  } catch (err) {
    // don't throw to avoid aborting the whole transaction for ledger insertion errors.
    // but log for diagnostics
    console.error("Failed to write StockLedger:", err);
  }
}

/**
 * Helper: create audit log entry
 */
async function createAudit({ session, entry }) {
  try {
    await AuditLog.create([entry], { session });
  } catch (err) {
    console.error("Failed to write AuditLog:", err);
  }
}

/**
 * PATCH /api/purchases/:purchaseId/update-prices
 * Body: { purchasedItems: [ ... ] }
 *
 * This endpoint:
 *  - Validates purchase exists and is editable
 *  - Replaces purchase.purchasedItems with provided items (same behavior as you had)
 *  - Updates SerializedStock and NonSerializedStock sellingPrice fields to match updated purchase items
 *  - Uses bulkWrite and transactions
 *  - Writes AuditLog and StockLedger correction entries capturing prev/new prices
 */
exports.updatePurchaseSellingPrice = async (req, res) => {
  const session = await mongoose.startSession();
  try {
    const { purchaseId } = req.params;
    const { purchasedItems } = req.body;

    // Basic validation
    if (!purchaseId)
      return res.status(400).json({ message: "purchaseId required" });
    if (!Array.isArray(purchasedItems) || purchasedItems.length === 0) {
      return res.status(400).json({ message: "purchasedItems array required" });
    }

    // Start transaction
    let resultSummary = {
      purchaseUpdated: false,
      serializedUpdatedCount: 0,
      nonSerializedUpdatedCount: 0,
      errors: [],
    };

    await session.withTransaction(async () => {
      // 1) Load existing purchase
      const purchase = await Purchase.findById(purchaseId).session(session);
      if (!purchase) {
        throw { status: 404, message: "Purchase not found" };
      }

      // Guard: prevent editing if already Paid
      if (purchase.payment_status === "Paid") {
        throw {
          status: 403,
          message: "Cannot edit a purchase that is already Paid",
        };
      }

      // 2) Normalize item IDs and collect serial numbers and batch keys to update
      const serialsToUpdate = []; // { serialNumber, newSellingPrice }
      const batchKeysToUpdate = []; // { itemId, batchNumber, newSellingPrice }
      const itemDefaultUpdates = []; // optional: if you want to update purchase-level sellingPrice only

      // We'll also keep a map to produce Audit/prevPrice info: key -> prevPrice
      // For serials use serialNumber -> prevPrice
      // For batches use `${itemId}__${batchNumber}` -> prevPrice

      for (const item of purchasedItems) {
        const itemIdNorm = normalizeId(item.item_id);

        if (item.isSerialized) {
          const serializedItems = item.serializedItems || [];
          for (const s of serializedItems) {
            if (!s.serialNumber) {
              resultSummary.errors.push({
                item,
                message: "serialized item missing serialNumber",
              });
              continue;
            }
            serialsToUpdate.push({
              serialNumber: String(s.serialNumber),
              newSellingPrice: Number(s.sellingPrice || item.sellingPrice || 0),
              item_id: itemIdNorm,
            });
          }
        } else {
          // For non-serialized we prefer batch_number
          const batchNumber = item.batch_number;
          if (!batchNumber) {
            resultSummary.errors.push({
              item,
              message: "non-serialized item missing batch_number",
            });
            continue;
          }
          batchKeysToUpdate.push({
            itemId: itemIdNorm,
            batchNumber: String(batchNumber),
            newSellingPrice: Number(item.sellingPrice || 0),
          });
        }
      } // end for items

      // 3) Update the Purchase document (preserve your previous business rule: replace purchasedItems)
      purchase.purchasedItems = purchasedItems;
      await purchase.save({ session });
      resultSummary.purchaseUpdated = true;

      // 4) Bulk fetch existing serials and batches to capture previous prices
      const serialNumbers = serialsToUpdate.map((s) => s.serialNumber);
      const uniqueSerialNumbers = Array.from(new Set(serialNumbers));

      const batchFilters = batchKeysToUpdate.map((b) => ({
        item_id: new mongoose.Types.ObjectId(b.itemId),
        batch_number: b.batchNumber,
      }));

      let existingSerialDocs = [];
      if (uniqueSerialNumbers.length) {
        existingSerialDocs = await SerializedStock.find({
          serialNumber: { $in: uniqueSerialNumbers },
        }).session(session);
      }

      let existingBatchDocs = [];
      if (batchFilters.length) {
        existingBatchDocs = await NonSerializedStock.find({
          $or: batchFilters,
        }).session(session);
      }

      // Build lookup maps
      const serialDocMap = new Map(
        existingSerialDocs.map((d) => [String(d.serialNumber), d])
      );
      const batchDocMap = new Map(
        existingBatchDocs.map((d) => [
          `${String(d.item_id)}__${d.batch_number}`,
          d,
        ])
      );

      // 5) Build bulkWrite operations
      const serializedBulkOps = []; // for SerializedStock
      const nonSerializedBulkOps = []; // for NonSerializedStock

      // Also accumulate ledger + audit write docs (we will insert these after bulkWrite to reflect after-values)
      const ledgerDocs = [];
      const auditDocs = [];

      // Process serial updates
      for (const s of serialsToUpdate) {
        const existing = serialDocMap.get(String(s.serialNumber));
        if (!existing) {
          // serial not found: collect warning but continue
          resultSummary.errors.push({
            type: "serial_not_found",
            serial: s.serialNumber,
          });
          continue;
        }

        const prevPrice = existing.sellingPrice ?? null;
        const newPrice = s.newSellingPrice;

        // guard: do not update if status is sold/damaged (unless front-end sets force flag; can be added)
        if (existing.status && existing.status !== "Available") {
          // skip and record
          resultSummary.errors.push({
            type: "serial_status_block",
            serial: s.serialNumber,
            status: existing.status,
          });
          continue;
        }

        // prepare update op
        serializedBulkOps.push({
          updateOne: {
            filter: { _id: existing._id },
            update: { $set: { sellingPrice: newPrice } },
          },
        });

        // ledger doc (qty 0: price correction)
        ledgerDocs.push({
          item_id: existing.item_id,
          variant_id: existing.variant_id || null,
          purchase_id: existing.purchase_id || null,
          serialNumber: existing.serialNumber,
          movementType: "Correction",
          qty: 0,
          opening_balance: existing.availableQty ?? 0,
          closing_balance: existing.availableQty ?? 0,
          batch_number: existing.batch_number,
          unitCost: existing.unitCost ?? null,
          sellingPrice: newPrice,
          memo: `Price updated from ${prevPrice} to ${newPrice} for serial ${existing.serialNumber}`,
          createdAt: new Date(),
        });

        auditDocs.push({
          action: "PRICE_UPDATE_SERIAL",
          reference: { serial: existing.serialNumber, stock_id: existing._id },
          before: { sellingPrice: prevPrice },
          after: { sellingPrice: newPrice },
          reason: "Purchase price edit",
          createdAt: new Date(),
        });
      }

      // Process batch updates
      for (const b of batchKeysToUpdate) {
        const key = `${b.itemId}__${b.batchNumber}`;
        const existing = batchDocMap.get(key);

        if (!existing) {
          resultSummary.errors.push({
            type: "batch_not_found",
            batch: b.batchNumber,
            itemId: b.itemId,
          });
          continue;
        }

        // guard: block if availableQty <= 0 (unless force)
        if ((existing.availableQty || 0) <= 0) {
          resultSummary.errors.push({
            type: "batch_no_stock",
            batch: b.batchNumber,
            itemId: b.itemId,
          });
          continue;
        }

        const prevPrice = existing.sellingPrice ?? null;
        const newPrice = b.newSellingPrice;

        nonSerializedBulkOps.push({
          updateOne: {
            filter: { _id: existing._id },
            update: { $set: { sellingPrice: newPrice } },
          },
        });

        ledgerDocs.push({
          item_id: existing.item_id,
          variant_id: null,
          purchase_id: existing.purchase_id || null,
          serialNumber: null,
          movementType: "Correction",
          qty: 0,
          opening_balance:
            existing.beforePurchaseAvailableQty ?? existing.availableQty ?? 0,
          closing_balance: existing.availableQty ?? 0,
          batch_number: existing.batch_number,
          unitCost: existing.unitCost ?? null,
          sellingPrice: newPrice,
          memo: `Batch price updated from ${prevPrice} to ${newPrice} for batch ${existing.batch_number}`,
          createdAt: new Date(),
        });

        auditDocs.push({
          action: "PRICE_UPDATE_BATCH",
          reference: { batch: existing.batch_number, stock_id: existing._id },
          before: { sellingPrice: prevPrice },
          after: { sellingPrice: newPrice },
          reason: "Purchase price edit",
          createdAt: new Date(),
        });
      }

      // 6) Execute bulkWrite operations (if any)
      if (serializedBulkOps.length) {
        const r = await SerializedStock.bulkWrite(serializedBulkOps, {
          session,
        });
        // modifiedCount is driver-dependent; best to compute by counting ops executed if needed
        resultSummary.serializedUpdatedCount =
          (r && (r.modifiedCount || r.nModified || 0)) ||
          resultSummary.serializedUpdatedCount;
      }

      if (nonSerializedBulkOps.length) {
        const r = await NonSerializedStock.bulkWrite(nonSerializedBulkOps, {
          session,
        });
        resultSummary.nonSerializedUpdatedCount =
          (r && (r.modifiedCount || r.nModified || 0)) ||
          resultSummary.nonSerializedUpdatedCount;
      }

      // 7) Insert ledger + audit docs (if any)
      if (ledgerDocs.length) {
        // We intentionally insert in bulk but in controlled fashion
        // Ensure documents adhere to StockLedger schema
        try {
          await StockLedger.insertMany(ledgerDocs, { session });
        } catch (err) {
          // ledger failures shouldn't abort the transaction silently; record error and continue
          console.error("StockLedger insertMany failed:", err);
          resultSummary.errors.push({
            type: "ledger_insert_failed",
            message: err.message,
          });
        }
      }

      if (auditDocs.length) {
        try {
          await AuditLog.insertMany(auditDocs, { session });
        } catch (err) {
          console.error("AuditLog insertMany failed:", err);
          resultSummary.errors.push({
            type: "audit_insert_failed",
            message: err.message,
          });
        }
      }
    }); // end transaction

    // success
    return res.json({
      message: "Purchase & stock prices updated",
      resultSummary,
    });
  } catch (err) {
    console.error("updatePurchaseSellingPrice error:", err);
    // If our thrown object has status, message, respect it
    if (err && err.status) {
      return res.status(err.status).json({ message: err.message || "Error" });
    }
    return res
      .status(500)
      .json({
        message: "Failed to update purchase selling prices",
        error: err.message || err,
      });
  } finally {
    try {
      await session.endSession();
    } catch (e) {
      /* ignore */
    }
  }
};

exports.updatePurchase_old = async (req, res) => {
  try {
    const { purchaseId } = req.params;
    const purchaseData = req.body;

    const existingPurchase = await Purchase.findById(purchaseId);
    if (!existingPurchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    // Reverse stock changes
    for (const item of existingPurchase.purchasedItems) {
      if (item.isSerialized) {
        await SerializedStock.deleteMany({ purchase_id: purchaseId });
      } else {
        await NonSerializedStock.deleteMany({ purchase_id: purchaseId });
      }
    }

    // Reverse supplier account changes
    const supplierAccount = await Account.findOne({
      account_owner_type: "Supplier",
      related_party_id: existingPurchase.supplier,
    });

    if (!supplierAccount) {
      return res.status(404).json({ message: "Supplier account not found" });
    }

    supplierAccount.balance += existingPurchase.grand_total;
    await supplierAccount.save();

    // Update purchase data
    const batchNo = `BATCH-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 8)
      .toUpperCase()}`;

    purchaseData.purchasedItems = purchaseData.purchasedItems.map((item) => {
      if (item.isSerialized && item.serializedItems) {
        item.serializedItems = item.serializedItems.map((itm) => ({
          ...itm,
          batch_number: batchNo,
        }));
      }
      return {
        ...item,
        batch_number: batchNo,
      };
    });

    const updatedPurchase = await Purchase.findByIdAndUpdate(
      purchaseId,
      purchaseData,
      { new: true }
    );

    // Update stock
    for (const item of updatedPurchase.purchasedItems) {
      if (item.isSerialized) {
        for (const serializedItem of item.serializedItems) {
          await SerializedStock.create({
            item_id: item.item_id,
            purchase_id: updatedPurchase._id,
            serialNumber: serializedItem.serialNumber,
            batch_number: item.batch_number,
            purchaseDate: updatedPurchase.purchaseDate,
            unitCost: serializedItem.unitCost,
            sellingPrice: serializedItem.sellingPrice,
            status: "Available",
          });
        }
      } else {
        await NonSerializedStock.create({
          item_id: item.item_id,
          purchase_id: updatedPurchase._id,
          batch_number: item.batch_number,
          purchaseDate: updatedPurchase.purchaseDate,
          purchaseQty: item.purchaseQty,
          availableQty: item.purchaseQty,
          unitCost: item.unitCost,
          sellingPrice: item.sellingPrice,
          unit: item.unit,
        });
      }
    }

    // Update supplier account
    supplierAccount.balance -= updatedPurchase.grand_total;
    await supplierAccount.save();

    // Remove transaction record
    await Transaction.deleteOne({
      account_id: supplierAccount._id,
      amount: existingPurchase.grand_total * -1,
      reason: `Purchase: ${existingPurchase.referenceNumber}`,
    });

    // Record the transaction
    const transaction = new Transaction({
      account_id: supplierAccount._id,
      amount: updatedPurchase.grand_total * -1,
      transaction_type: "Withdrawal",
      reason: `Purchase: ${updatedPurchase.referenceNumber}`,
      transaction_date: new Date(),
      balance_after_transaction: supplierAccount.balance,
    });

    await transaction.save();

    res.status(200).json({
      message: "Purchase updated successfully",
      purchase: updatedPurchase,
    });
  } catch (error) {
    console.error("Error updating purchase:", error);
    res.status(500).json({ message: "Error updating purchase", error });
  }
};

exports.deletePurchase = async (req, res) => {
  try {
    const { purchaseId } = req.params;

    const existingPurchase = await Purchase.findById(purchaseId);
    if (!existingPurchase) {
      return res.status(404).json({ message: "Purchase not found" });
    }

    // Check payment status
    if (existingPurchase.payment_status !== "Not Paid") {
      return res.status(400).json({
        message: 'Only purchases with "Not Paid" status can be deleted',
      });
    }

    // Reverse stock changes
    for (const item of existingPurchase.purchasedItems) {
      if (item.isSerialized) {
        await SerializedStock.deleteMany({ purchase_id: purchaseId });
      } else {
        await NonSerializedStock.deleteMany({ purchase_id: purchaseId });
      }
    }

    // New: Remove all related StockLedger entries
    await StockLedger.deleteMany({ purchase_id: purchaseId });

    // Reverse supplier account changes - ONLY if verification happened
    const supplierAccount = await Account.findOne({
      account_owner_type: "Supplier",
      related_party_id: existingPurchase.supplier,
    });

    if (!supplierAccount) {
      return res.status(404).json({ message: "Supplier account not found" });
    }

    // Determine the exact amount that was deducted from the supplier balance during verification or creation
    // If it reached "Received" or "Discrepancy", it used actual_grand_total (if discrepancy) or grand_total
    if (["Received", "Discrepancy"].includes(existingPurchase.purchase_status)) {
      const amountToRevert = existingPurchase.discrepancy_details?.actual_grand_total ?? existingPurchase.grand_total;
      supplierAccount.balance += amountToRevert;
      await supplierAccount.save();
    }

    // Delete purchase
    await Purchase.findByIdAndDelete(purchaseId);

    // Remove transaction record
    // Using regex for reason to match both "Purchase: [REF]" and "Verified Purchase: [REF]"
    await Transaction.deleteOne({
      account_id: supplierAccount._id,
      reason: { $regex: existingPurchase.referenceNumber },
    });

    res.status(200).json({ message: "Purchase deleted successfully" });
  } catch (error) {
    console.error("Error deleting purchase:", error);
    res.status(500).json({ message: "Error deleting purchase", error });
  }
};

// Utility: build map of serial -> { si, lineIndex, lineRef }
const buildSerializedMap = (purchaseItems) => {
  const map = new Map();
  purchaseItems.forEach((line, li) => {
    if (line?.isSerialized && Array.isArray(line.serializedItems)) {
      line.serializedItems.forEach((si) => {
        if (si?.serialNumber) {
          map.set(String(si.serialNumber), {
            si,
            lineIndex: li,
            lineRef: line,
          });
        }
      });
    }
  });
  return map;
};

// Utility: stable key for non-serialized lines (prefer line._id)
const keyForNonSerialized = (line) => {
  if (!line) return null;
  if (line._id) return `LINE_${String(line._id)}`;
  return `ITEM_${String(line.item_id)}_VAR_${String(line.variant_id || "")}`;
};

exports.updatePurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { purchaseId } = req.params;
    console.log("Updating purchase:", purchaseId);
    const incoming = req.body;

    if (!purchaseId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "purchaseId is required" });
    }

    // Load existing purchase
    const existingPurchase = await Purchase.findById(purchaseId).session(
      session
    );
    if (!existingPurchase) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Purchase not found" });
    }

    // Guard: fully-paid purchases cannot be edited
    if (
      existingPurchase.payment_status === "Paid" ||
      Number(existingPurchase.payment_due_amount || 0) <= 0
    ) {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        message:
          "Cannot edit a fully paid purchase. Use a credit or reversal workflow.",
      });
    }

    // Validate incoming.purchasedItems existence
    if (
      !Array.isArray(incoming.purchasedItems) ||
      incoming.purchasedItems.length === 0
    ) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(400)
        .json({ message: "purchasedItems must be a non-empty array" });
    }

    // 1. Derive or Generate Batch Number for this purchase
    let finalBatchNumber = existingPurchase.purchasedItems.find(i => i.batch_number)?.batch_number;
    if (!finalBatchNumber) {
      finalBatchNumber = `BATCH-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    }

    // 2. Map batch_number and total_price to ALL incoming items to satisfy schema requirements
    incoming.purchasedItems = incoming.purchasedItems.map(item => {
      const qty = Number(item.purchaseQty || 0);
      const cost = Number(item.unitCost || 0);

      const updatedItem = {
        ...item,
        batch_number: item.batch_number || finalBatchNumber,
        total_price: item.total_price || (qty * cost)
      };

      // Also ensure serialized items have it if they exist
      if (updatedItem.isSerialized && Array.isArray(updatedItem.serializedItems)) {
        updatedItem.serializedItems = updatedItem.serializedItems.map(si => ({
          ...si,
          batch_number: si.batch_number || updatedItem.batch_number
        }));
      }
      return updatedItem;
    });

    // Build serialized maps
    const oldSerializedMap = buildSerializedMap(
      existingPurchase.purchasedItems
    );
    const newSerializedMap = buildSerializedMap(incoming.purchasedItems);

    // Compute added/removed/modified serials
    const addedSerials = [];
    const removedSerials = [];
    const modifiedSerials = [];

    for (const [serial, newMeta] of newSerializedMap.entries()) {
      if (!oldSerializedMap.has(serial)) {
        addedSerials.push({
          serial,
          newSi: newMeta.si,
          lineRef: newMeta.lineRef,
        });
      } else {
        const { si: oldSi } = oldSerializedMap.get(serial);
        const { si: newSi } = newMeta;
        // meaningful changes detection
        const changed =
          Number(oldSi.unitCost || 0) !== Number(newSi.unitCost || 0) ||
          Number(oldSi.sellingPrice || 0) !== Number(newSi.sellingPrice || 0) ||
          String(oldSi.variant_id || "") !== String(newSi.variant_id || "") ||
          String(oldSi.batch_number || "") !==
          String(newSi.batch_number || "") ||
          Number(oldSi.batteryHealth || 0) !==
          Number(newSi.batteryHealth || 0) ||
          String(oldSi.condition || "") !== String(newSi.condition || "");
        if (changed)
          modifiedSerials.push({
            serial,
            oldSi,
            newSi,
            lineRef: newMeta.lineRef,
          });
      }
    }

    for (const [serial, oldMeta] of oldSerializedMap.entries()) {
      if (!newSerializedMap.has(serial)) {
        removedSerials.push({
          serial,
          oldSi: oldMeta.si,
          lineRef: oldMeta.lineRef,
        });
      }
    }

    console.log("Added Serials:", addedSerials);
    console.log("Removed Serials:", removedSerials);
    console.log("Modified Serials:", modifiedSerials);

    // Validate removed serialized units are safe to remove (must be Available)
    for (const { serial } of removedSerials) {
      const stockRec = await SerializedStock.findOne({
        serialNumber: serial,
      }).session(session);
      if (!stockRec) continue; // No record -> safe (but strange)
      if (stockRec.status !== "Available") {
        await session.abortTransaction();
        session.endSession();
        return res.status(400).json({
          message: `Cannot remove serial ${serial} because its stock status is "${stockRec.status}". Revert sale/transfer first.`,
        });
      }
    }

    // Build non-serialized maps and compute deltas
    const oldNonMap = new Map();
    existingPurchase.purchasedItems.forEach((line) => {
      if (!line.isSerialized) oldNonMap.set(keyForNonSerialized(line), line);
    });
    const newNonMap = new Map();
    incoming.purchasedItems.forEach((line) => {
      if (!line.isSerialized) newNonMap.set(keyForNonSerialized(line), line);
    });

    const nonSerializedDeltas = [];
    const allKeys = new Set([...oldNonMap.keys(), ...newNonMap.keys()]);
    for (const k of allKeys) {
      const oldLine = oldNonMap.get(k) || null;
      const newLine = newNonMap.get(k) || null;
      const oldQty = oldLine ? Number(oldLine.purchaseQty || 0) : 0;
      const newQty = newLine ? Number(newLine.purchaseQty || 0) : 0;
      const deltaQty = newQty - oldQty;
      nonSerializedDeltas.push({ key: k, oldLine, newLine, deltaQty });
    }

    // Validate non-serialized decreases: ensure availableQty covers removal
    for (const d of nonSerializedDeltas) {
      if (d.deltaQty < 0 && d.oldLine) {
        const itemId = d.oldLine.item_id;
        const stocks = await NonSerializedStock.find({
          purchase_id: existingPurchase._id,
          item_id: itemId,
        }).session(session);

        const totalAvailable = stocks.reduce(
          (s, st) => s + (st.availableQty || 0),
          0
        );
        const toRemove = -d.deltaQty;
        if (totalAvailable < toRemove) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            message: `Cannot reduce quantity for item ${itemId} by ${toRemove}. Only ${totalAvailable} available (some already consumed/sold).`,
          });
        }
      }
    }

    // ---------- All validations passed. Apply changes ----------

    // 1) Handle serialized removals (delete only purchase_id-anchored Available rows)
    for (const { serial, oldSi, lineRef } of removedSerials) {
      await SerializedStock.deleteOne({
        serialNumber: serial,
        purchase_id: existingPurchase._id,
      }).session(session);
      // ledger entry
      const prevLedger = await StockLedger.findOne({ serialNumber: serial })
        .sort({ createdAt: -1 })
        .session(session)
        .lean();
      const ledger = makeLedgerEntry({
        item_id: lineRef.item_id || null,
        variant_id: oldSi.variant_id || null,
        purchase_id: existingPurchase._id,
        serialNumber: serial,
        movementType: "Purchase-Delete-Reverse",
        qty: -1,
        previousLedger: prevLedger,
        batch_number: oldSi.batch_number || existingPurchase.batch_number,
        unitCost: oldSi.unitCost,
        sellingPrice: oldSi.sellingPrice,
        memo: `Serial removed by purchase update ${existingPurchase.referenceNumber}`,
      });
      await StockLedger.create([ledger], { session });
    }

    // 2) Handle serialized modifications: update stock row if Available
    for (const mod of modifiedSerials) {
      const { serial, newSi } = mod;
      const stockRec = await SerializedStock.findOne({
        serialNumber: serial,
        purchase_id: existingPurchase._id,
      }).session(session);
      if (!stockRec) continue;
      if (stockRec.status !== "Available") {
        // Skip immutable sold units
        continue;
      }
      // update allowed fields
      if (typeof newSi.unitCost !== "undefined")
        stockRec.unitCost = newSi.unitCost;
      if (typeof newSi.sellingPrice !== "undefined")
        stockRec.sellingPrice = newSi.sellingPrice;
      if (typeof newSi.variant_id !== "undefined")
        stockRec.variant_id = newSi.variant_id;
      if (typeof newSi.condition !== "undefined")
        stockRec.condition = newSi.condition;
      if (typeof newSi.batteryHealth !== "undefined")
        stockRec.batteryHealth = newSi.batteryHealth;
      // keep purchaseDate & batch as existing unless changed explicitly
      if (typeof newSi.batch_number !== "undefined")
        stockRec.batch_number = newSi.batch_number;
      await stockRec.save({ session });

      const prevLedger = await StockLedger.findOne({ serialNumber: serial })
        .sort({ createdAt: -1 })
        .session(session)
        .lean();
      const ledger = makeLedgerEntry({
        item_id: stockRec.item_id,
        variant_id: stockRec.variant_id,
        purchase_id: existingPurchase._id,
        serialNumber: serial,
        movementType: "Correction",
        qty: 0,
        previousLedger: prevLedger,
        batch_number: stockRec.batch_number,
        unitCost: stockRec.unitCost,
        sellingPrice: stockRec.sellingPrice,
        memo: `Serialized unit modified by purchase update ${existingPurchase.referenceNumber}`,
      });
      await StockLedger.create([ledger], { session });
    }

    // 3) Handle serialized additions
    for (const add of addedSerials) {
      const { newSi, lineRef } = add;
      // check serial uniqueness
      const existing = await SerializedStock.findOne({
        serialNumber: newSi.serialNumber,
      }).session(session);
      if (existing) {
        // if exists but tied to same purchase skip; otherwise reject
        if (String(existing.purchase_id) !== String(existingPurchase._id)) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({
            message: `Serial ${newSi.serialNumber} already exists in stock linked to another purchase.`,
          });
        } else {
          continue;
        }
      }

      await SerializedStock.create(
        [
          {
            item_id: lineRef.item_id,
            variant_id: newSi.variant_id || lineRef.variant_id,
            purchase_id: existingPurchase._id,
            serialNumber: newSi.serialNumber,
            batch_number: newSi.batch_number || existingPurchase.batch_number,
            purchaseDate:
              incoming.purchaseDate || existingPurchase.purchaseDate,
            unitCost: newSi.unitCost,
            sellingPrice: newSi.sellingPrice,
            status: "Available",
            batteryHealth: newSi.batteryHealth,
            condition: newSi.condition,
          },
        ],
        { session }
      );

      const prevLedger = await StockLedger.findOne({
        item_id: lineRef.item_id,
        variant_id: newSi.variant_id || lineRef.variant_id,
      })
        .sort({ createdAt: -1 })
        .session(session)
        .lean();

      const ledger = makeLedgerEntry({
        item_id: lineRef.item_id,
        variant_id: newSi.variant_id || lineRef.variant_id,
        purchase_id: existingPurchase._id,
        serialNumber: newSi.serialNumber,
        movementType: "Purchase-In",
        qty: 1,
        previousLedger: prevLedger,
        batch_number: newSi.batch_number || existingPurchase.batch_number,
        unitCost: newSi.unitCost,
        sellingPrice: newSi.sellingPrice,
        memo: `Serialized added by purchase update ${existingPurchase.referenceNumber}`,
      });
      await StockLedger.create([ledger], { session });
    }

    // 4) Non-serialized adjustments (create for increases; reduce FIFO for decreases; update price for zero-delta)
    for (const d of nonSerializedDeltas) {
      // 1. We already have finalBatchNumber derived at the top
      const { oldLine, newLine, deltaQty } = d;
      if (deltaQty === 0) {
        // update price fields in NonSerializedStock rows belonging to this purchase only (if client changed pricing)
        if (oldLine && newLine) {
          await NonSerializedStock.updateMany(
            {
              purchase_id: existingPurchase._id,
              item_id: oldLine.item_id,
              variant_id: oldLine.variant_id || null,
            },
            {
              $set: {
                unitCost:
                  typeof newLine.unitCost !== "undefined"
                    ? newLine.unitCost
                    : oldLine.unitCost,
                sellingPrice:
                  typeof newLine.sellingPrice !== "undefined"
                    ? newLine.sellingPrice
                    : oldLine.sellingPrice,
              },
            },
            { session }
          );
        }
        continue;
      }

      if (deltaQty > 0) {
        // create new NonSerializedStock entry for delta

        await NonSerializedStock.create(
          [
            {
              item_id: newLine.item_id,
              variant_id: newLine.variant_id || null,
              purchase_id: existingPurchase._id,
              batch_number:
                finalBatchNumber,
              purchaseDate:
                incoming.purchaseDate || existingPurchase.purchaseDate,
              purchaseQty: deltaQty,
              availableQty: deltaQty,
              beforePurchaseAvailableQty: 0,
              unitCost: newLine.unitCost,
              sellingPrice: newLine.sellingPrice,
              unit: newLine.unit || "pcs",
              condition: newLine.condition || "Brand New"
            },
          ],
          { session }
        );

        // ledger
        const prevLedger = await StockLedger.findOne({
          item_id: newLine.item_id,
          variant_id: newLine.variant_id || null,
        })
          .sort({ createdAt: -1 })
          .session(session)
          .lean();

        const ledger = makeLedgerEntry({
          item_id: newLine.item_id,
          variant_id: newLine.variant_id || null,
          movementType: "Purchase-In",
          qty: deltaQty,
          previousLedger: prevLedger,
          purchase_id: existingPurchase._id,
          batch_number: finalBatchNumber,
          unitCost: newLine.unitCost,
          sellingPrice: newLine.sellingPrice,
          memo: `Non-serialized increase by purchase update ${existingPurchase.referenceNumber}`,
        });
        await StockLedger.create([ledger], { session });
      } else {
        // deltaQty < 0 => reduce availableQty FIFO across NonSerializedStock rows for this purchase & item
        let qtyToRemove = -deltaQty;
        const stocks = await NonSerializedStock.find({
          purchase_id: existingPurchase._id,
          item_id: oldLine.item_id,
          variant_id: oldLine.variant_id || null,
          availableQty: { $gt: 0 },
        })
          .sort({ purchaseDate: 1 })
          .session(session);

        for (const st of stocks) {
          if (qtyToRemove <= 0) break;
          const reduc = Math.min(st.availableQty, qtyToRemove);
          st.availableQty = Math.max(0, st.availableQty - reduc);
          st.purchaseQty = Math.max(0, (st.purchaseQty || 0) - reduc);
          await st.save({ session });

          const prevLedger = await StockLedger.findOne({
            item_id: st.item_id,
            variant_id: st.variant_id || null,
          })
            .sort({ createdAt: -1 })
            .session(session)
            .lean();

          const ledger = makeLedgerEntry({
            item_id: st.item_id,
            variant_id: st.variant_id || null,
            movementType: "Purchase-NonSerialized-Remove",
            qty: -reduc,
            previousLedger: prevLedger,
            purchase_id: existingPurchase._id,
            batch_number: st.batch_number,
            unitCost: st.unitCost,
            sellingPrice: st.sellingPrice,
            memo: `Non-serialized decrease by purchase update ${existingPurchase.referenceNumber}`,
          });
          await StockLedger.create([ledger], { session });

          qtyToRemove -= reduc;
        }

        if (qtyToRemove > 0) {
          await session.abortTransaction();
          session.endSession();
          return res
            .status(500)
            .json({
              message:
                "Failed to consume required qty while reducing non-serialized items.",
            });
        }
      }
    }

    // ---------- Recompute grand total server-side ----------
    const recomputeGrandTotal = (purchasedItems) => {
      const raw = purchasedItems.reduce((acc, li) => {
        if (li.isSerialized && Array.isArray(li.serializedItems)) {
          return (
            acc +
            li.serializedItems.reduce(
              (s, si) => s + Number(si.unitCost || 0),
              0
            )
          );
        }
        return acc + Number(li.purchaseQty || 0) * Number(li.unitCost || 0);
      }, 0);
      const afterDiscount =
        raw -
        Number(
          incoming.purchase_discount || existingPurchase.purchase_discount || 0
        );
      const afterTax =
        afterDiscount +
        (afterDiscount *
          Number(incoming.purchase_tax || existingPurchase.purchase_tax || 0)) /
        100;
      return Number(afterTax.toFixed(2));
    };

    const newGrandTotal = recomputeGrandTotal(incoming.purchasedItems);
    const oldGrandTotal = Number(existingPurchase.grand_total || 0);
    const deltaAmount = Number(newGrandTotal) - Number(oldGrandTotal);

    // ---------- Update purchase document (whitelist fields) ----------
    const safeUpdates = {
      // Keep supplier & referenceNumber immutable unless you intentionally allow change
      purchaseDate: incoming.purchaseDate || existingPurchase.purchaseDate,
      purchase_tax:
        typeof incoming.purchase_tax !== "undefined"
          ? incoming.purchase_tax
          : existingPurchase.purchase_tax,
      purchase_discount:
        typeof incoming.purchase_discount !== "undefined"
          ? incoming.purchase_discount
          : existingPurchase.purchase_discount,
      purchasedItems: incoming.purchasedItems,
      total_items_count: incoming.purchasedItems.length,
      grand_total: newGrandTotal,
      payment_due_amount: existingPurchase.payment_due_amount + deltaAmount, // adjust due vs previous
      purchase_status:
        incoming.purchase_status || existingPurchase.purchase_status,
      updated_at: new Date(),
    };

    const updatedPurchase = await Purchase.findByIdAndUpdate(
      existingPurchase._id,
      safeUpdates,
      { new: true, session }
    );

    // ---------- Adjust supplier account (append-only) ----------
    const supplierAccount = await Account.findOne({
      account_owner_type: "Supplier",
      related_party_id: updatedPurchase.supplier,
    }).session(session);

    if (!supplierAccount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Supplier account not found" });
    }

    if (deltaAmount !== 0) {
      // follow your createPurchase convention: supplier.balance = supplier.balance - purchaseAmount
      supplierAccount.balance =
        Number(supplierAccount.balance || 0) - deltaAmount;
      await supplierAccount.save({ session });

      const trans = new Transaction({
        account_id: supplierAccount._id,
        amount: deltaAmount * -1,
        transaction_type: deltaAmount > 0 ? "Withdrawal" : "Deposit",
        reason: `Purchase Update Delta: ${updatedPurchase.referenceNumber}`,
        transaction_date: new Date(),
        balance_after_transaction: supplierAccount.balance,
      });

      await trans.save({ session });
    }

    // ---------- Audit log ----------
    await AuditLog.create(
      [
        {
          action: "PURCHASE_UPDATED",
          purchase_id: updatedPurchase._id,
          performedBy: req.user ? req.user._id : null,
          before: existingPurchase,
          after: updatedPurchase,
          createdAt: new Date(),
          description: `Purchase ${updatedPurchase.referenceNumber} updated.`,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res
      .status(200)
      .json({
        message: "Purchase updated successfully",
        purchase: updatedPurchase,
      });
  } catch (err) {
    console.error("updatePurchase error:", err);
    try {
      await session.abortTransaction();
      session.endSession();
    } catch (e) {
      console.error("error aborting transaction", e);
    }
    return res
      .status(500)
      .json({
        message: String(err) || "Error updating purchase",
        error: String(err),
      });
  }
};

// Helper: create stock ledger entry object
const makeLedgerEntry = ({
  item_id,
  variant_id = null,
  purchase_id = null,
  serialNumber = null,
  movementType,
  qty,
  previousLedger = null,
  batch_number = null,
  unitCost = null,
  sellingPrice = null,
  memo = "",
}) => {
  const opening = previousLedger?.closing_balance ?? 0;
  return {
    item_id,
    variant_id,
    purchase_id,
    serialNumber,
    movementType,
    qty,
    opening_balance: opening,
    closing_balance: opening + qty,
    batch_number,
    unitCost,
    sellingPrice,
    memo,
    createdAt: new Date(),
  };
};

exports.createStockLedgerEntry = ({
  item_id,
  variant_id = null,
  purchase_id = null,
  serialNumber = null,
  movementType,
  qty,
  previousLedger = null,
  batch_number = null,
  unitCost = null,
  sellingPrice = null,
  memo = "",
}) => ({
  item_id,
  variant_id,
  purchase_id,
  serialNumber,
  movementType,
  qty,
  opening_balance: previousLedger?.closing_balance || 0,
  closing_balance: (previousLedger?.closing_balance || 0) + qty,
  batch_number,
  unitCost,
  sellingPrice,
  memo,
  createdAt: new Date(),
});
exports.checkReferenceNumber = async (req, res) => {
  try {
    const { referenceNumber } = req.params;
    // Case-insensitive check for existing reference number
    const exists = await Purchase.findOne({
      referenceNumber: { $regex: new RegExp(`^${referenceNumber}$`, "i") },
    });
    res.json({ exists: !!exists });
  } catch (error) {
    console.error("Error checking reference number:", error);
    res
      .status(500)
      .json({ message: "Error checking reference number", error: error.message });
  }
};
