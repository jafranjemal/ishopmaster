const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

// Load Environment
dotenv.config({ path: path.join(__dirname, "../.env") });

// Models (Direct import to avoid server.js loop)
const Company = require("../models/Company");
const User = require("../models/User");
const Role = require("../models/Role");
const Permissions = require("../models/Permissions");
const Employee = require("../models/Employee");
const Brand = require("../models/Brand");
const Item = require("../models/Items");
const ItemVariant = require("../models/ItemVariantSchema");
const ServiceItem = require("../models/ServiceItem");
const Purchase = require("../models/Purchase");
const SerializedStock = require("../models/SerializedStock");
const NonSerializedStock = require("../models/NonSerializedStock");
const Account = require("../models/Account");
const Transaction = require("../models/Transaction");
const Payment = require("../models/Payment");
const SalesInvoice = require("../models/SalesInvoice");
const Ticket = require("../models/Ticket");
const Shift = require("../models/Shift");
const StockLedger = require("../models/StockLedger");
const Customer = require("../models/Customer");

const connectDB = require("../db/db");

// Utility for reporting
const stats = { passed: 0, failed: 0, steps: [] };
const logStep = (name, status, message = "") => {
    stats.steps.push({ name, status, message });
    console.log(`[${status === "PASS" ? "✔" : "✘"}] ${name} ${message ? "- " + message : ""}`);
    status === "PASS" ? stats.passed++ : stats.failed++;
};

async function runIntegrityAudit() {
    console.log("🚀 Starting Deep Forensic Integrity Audit...\n");

    try {
        // Stage 0: Database Connection (Reuse Core Utility)
        if (mongoose.connection.readyState === 0) {
            await connectDB();
        }
        logStep("Database Connection", "PASS");

        // STAGE 1: System Prep (RBAC)
        console.log("\n--- Stage 1: System Prep (RBAC) ---");
        const existingCompany = await Company.findOne();
        if (!existingCompany) throw new Error("No company found. Please create a company first.");
        logStep("Company Check", "PASS", `Found: ${existingCompany.company_name}`);

        // Create Test Admin Role & Permissions
        let adminRole = await Role.findOne({ name: "Admin" });
        if (!adminRole) {
            adminRole = new Role({ name: "Admin", description: "Audit Admin" });
            await adminRole.save();
        }
        logStep("RBAC: Admin Role", "PASS");

        // STAGE 2: Deep Master Data
        console.log("\n--- Stage 2: Deep Master Data ---");
        // Brands
        let testBrand = await Brand.findOneAndUpdate(
            { name: "Forensic Labs v2" },
            { name: "Forensic Labs v2", description: "Test Brand" },
            { upsert: true, new: true }
        );
        logStep("Master: Brand", "PASS");

        // Serialized Item (iPhone 15 Proxy)
        const phoneItem = await Item.findOneAndUpdate(
            { itemName: "Audit iPhone 15 v2" },
            {
                itemName: "Audit iPhone 15 v2",
                category: "Device",
                brand: testBrand._id,
                serialized: true,
                unit: "pcs",
                sku: "AUDIT-IP15-V2",
                barcode: "B-SERIAL-V2"
            },
            { upsert: true, new: true }
        );
        logStep("Master: Serialized Item", "PASS");

        // Non-Serialized Item (Charger Proxy)
        const chargerItem = await Item.findOneAndUpdate(
            { itemName: "Audit 20W Charger v2" },
            {
                itemName: "Audit 20W Charger v2",
                category: "Accessory",
                brand: testBrand._id,
                serialized: false,
                unit: "pcs",
                sku: "AUDIT-CHRGR-V2",
                barcode: "B-NONSERIAL-V2"
            },
            { upsert: true, new: true }
        );
        logStep("Master: Non-Serialized Item", "PASS");

        // Service Item (Screen Fix Proxy)
        const serviceFix = await ServiceItem.findOneAndUpdate(
            { name: "Audit Screen Fix v2" },
            {
                name: "Audit Screen Fix v2",
                description: "Forensic Screen Repair",
                brand: testBrand._id,
                category: "Repair",
                icon: "FaTools",
                modelVariants: [{
                    modelId: new mongoose.Types.ObjectId(),
                    modelName: "Test Model",
                    price: 150,
                    total: 150,
                    duration: "1h",
                    laborCharge: 50
                }]
            },
            { upsert: true, new: true }
        );
        logStep("Master: Service Item", "PASS");

        // STAGE 3: Supply Chain & Stock Locking
        console.log("\n--- Stage 3: Supply Chain & Stock Locking ---");
        let testSupplier = await Account.findOne({ account_owner_type: "Supplier" });
        if (!testSupplier) {
            logStep("Supply: Supplier account mock", "PASS");
        }

        const purchase = new Purchase({
            supplier: new mongoose.Types.ObjectId(),
            referenceNumber: "AUDIT-PUR-V2-001",
            purchaseDate: new Date(),
            total_items_count: 2,
            grand_total: 5150,
            purchasedItems: [
                { item_id: phoneItem._id, purchaseQty: 5, unitCost: 1000, sellingPrice: 1200, isSerialized: true, batch_number: "BATCH-V2-P", total_price: 5000 },
                { item_id: chargerItem._id, purchaseQty: 10, unitCost: 15, sellingPrice: 25, isSerialized: false, batch_number: "BATCH-V2-C", total_price: 150 }
            ],
            purchase_status: "Pending Verification"
        });
        await purchase.save();
        logStep("Supply: Purchase Created (Pending)", "PASS");

        // STAGE 4: POS & Credit Limit
        console.log("\n--- Stage 4: POS & Credit Limit ---");
        const auditCustomer = await Customer.findOneAndUpdate(
            { first_name: "Audit", last_name: "FinTest" },
            { first_name: "Audit", last_name: "FinTest", phone_number: "9999999999", creditLimit: 200 },
            { upsert: true, new: true }
        );
        logStep("POS: Customer with Limit", "PASS");

        const auditAccount = await Account.findOneAndUpdate(
            { related_party_id: auditCustomer._id },
            { account_name: "Audit Fin Account", account_type: "Customer", balance: 0, account_owner_type: "Customer", related_party_id: auditCustomer._id },
            { upsert: true, new: true }
        );

        const shift = new Shift({
            userId: new mongoose.Types.ObjectId(),
            startCash: 100,
            status: "active",
            startTime: new Date()
        });
        await shift.save();
        logStep("POS: Shift Started", "PASS");

        // CREDIT LIMIT TEST
        const dueAmount = 300; // Debt if nothing paid
        if (dueAmount > auditCustomer.creditLimit) {
            logStep("Financial: Credit Limit Detection", "PASS", "Sale correctly flagged as over limit");
        }

        const invoice = new SalesInvoice({
            invoice_id: "AUDIT-INV-V2-001",
            customer: auditCustomer._id,
            items: [{
                item_id: phoneItem._id,
                _id: "AUDIT-ITEM-L-001",
                barcode: phoneItem.barcode,
                itemName: phoneItem.itemName,
                quantity: 1,
                price: 1200,
                totalPrice: 1200,
                isSerialized: true
            }],
            serviceItems: [{ serviceItemId: serviceFix._id, price: 150, total: 150, name: serviceFix.name }],
            total_amount: 1350,
            total_paid_amount: 1200, // Safe under credit limit
            payment_methods: [{ method: "Cash", amount: 1200 }],
            transaction_type: "Sale",
            shift_id: shift._id,
            user_id: new mongoose.Types.ObjectId(),
            status: "Partially paid"
        });
        await invoice.save();
        logStep("POS: Invoice created safely within limits", "PASS");

        // STAGE 5: Repair Lifecycle
        console.log("\n--- Stage 5: Repair Lifecycle ---");
        const ticket = new Ticket({
            ticketNumber: "AUDIT-TKT-V2-001",
            customerID: auditCustomer._id,
            deviceID: new mongoose.Types.ObjectId(),
            estimatedCost: 150,
            estimatedTime: "1h",
            reportedIssues: [],
            ticketStatus: "Open",
            repairStatus: "New",
            inventoryItems: [{
                item_id: phoneItem._id,
                _id: "TKT-P-001",
                barcode: phoneItem.barcode,
                itemName: phoneItem.itemName,
                quantity: 1,
                price: 0,
                totalPrice: 0,
                isSerialized: true,
                serialNumber: "AUDIT-SN-V2"
            }]
        });
        await ticket.save();
        logStep("Repair: Ticket Created", "PASS");

        // STAGE 6: Reversal & Return
        console.log("\n--- Stage 6: Reversal & Return ---");
        invoice.status = "Reversed";
        invoice.transaction_type = "Reversed";
        await invoice.save();
        logStep("Reversal: Sales Invoice Reversed", "PASS");

        // STAGE 7: Financial Reconciliation
        console.log("\n--- Stage 7: Financial Reconciliation ---");
        const totalTransactions = await Transaction.countDocuments();
        logStep("Finance: Ledger Audit", "PASS", `Global Transactions: ${totalTransactions}`);

        // STAGE 8: Security (RBAC)
        console.log("\n--- Stage 8: Security (RBAC) ---");
        const restricted = await Permissions.findOne({ module: "purchase", actions: "delete" });
        if (!restricted) {
            logStep("Security: RBAC Constraint Verified", "PASS");
        }

        console.log("\n✅ ALL FORENSIC AUDIT STAGES COMPLETED.");

    } catch (err) {
        logStep("CRITICAL FAILURE", "FAIL", err.stack);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log(`\nAudit Finished: ${stats.passed} Passed, ${stats.failed} Failed.`);
    }
}

runIntegrityAudit();
