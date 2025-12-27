const PurchaseReturn = require('../models/PurchaseReturn');
const Purchase = require('../models/Purchase');
const StockLedger = require('../models/StockLedger');
const Supplier = require('../models/Supplier');
const Item = require('../models/Items');

/**
 * Validate if items can be returned (check if sold)
 */
exports.validateReturn = async (req, res) => {
    try {
        const { purchase_id, items } = req.body;

        const purchase = await Purchase.findById(purchase_id).populate('purchasedItems.item_id');
        if (!purchase) {
            return res.status(404).json({ message: 'Purchase not found' });
        }

        if (purchase.purchase_status !== 'Received') {
            return res.status(400).json({ message: 'Only verified purchases can be returned' });
        }

        const validationResults = [];

        for (const returnItem of items) {
            const purchaseItem = purchase.purchasedItems.find(
                pi => pi.item_id._id.toString() === returnItem.item_id
            );

            if (!purchaseItem) {
                validationResults.push({
                    item_id: returnItem.item_id,
                    valid: false,
                    reason: 'Item not found in purchase'
                });
                continue;
            }

            if (returnItem.quantity > purchaseItem.purchaseQty) {
                validationResults.push({
                    item_id: returnItem.item_id,
                    valid: false,
                    reason: `Return quantity (${returnItem.quantity}) exceeds purchased quantity (${purchaseItem.purchaseQty})`
                });
                continue;
            }

            // Check if items have been sold by analyzing stock ledger
            const soldQuantity = await StockLedger.aggregate([
                {
                    $match: {
                        item_id: purchaseItem.item_id._id,
                        purchase_id: purchase._id,
                        movementType: 'Sale-Out'
                    }
                },
                {
                    $group: {
                        _id: null,
                        total: { $sum: { $abs: '$qty' } }
                    }
                }
            ]);

            const totalSold = soldQuantity.length > 0 ? soldQuantity[0].total : 0;
            const availableToReturn = purchaseItem.purchaseQty - totalSold;

            if (returnItem.quantity > availableToReturn) {
                validationResults.push({
                    item_id: returnItem.item_id,
                    item_name: purchaseItem.item_id.item_name,
                    valid: false,
                    reason: `${totalSold} units already sold. Only ${availableToReturn} units available to return`,
                    purchased: purchaseItem.purchaseQty,
                    sold: totalSold,
                    available: availableToReturn
                });
                continue;
            }

            // For serialized items, check specific serial numbers
            if (purchaseItem.isSerialized && returnItem.serial_numbers) {
                const soldSerials = await StockLedger.find({
                    item_id: purchaseItem.item_id._id,
                    purchase_id: purchase._id,
                    movementType: 'Sale-Out',
                    serialNumber: { $in: returnItem.serial_numbers }
                }).select('serialNumber');

                if (soldSerials.length > 0) {
                    validationResults.push({
                        item_id: returnItem.item_id,
                        item_name: purchaseItem.item_id.item_name,
                        valid: false,
                        reason: `Serial numbers already sold: ${soldSerials.map(s => s.serialNumber).join(', ')}`,
                        sold_serials: soldSerials.map(s => s.serialNumber)
                    });
                    continue;
                }
            }

            validationResults.push({
                item_id: returnItem.item_id,
                item_name: purchaseItem.item_id.item_name,
                valid: true,
                purchased: purchaseItem.purchaseQty,
                sold: totalSold,
                available: availableToReturn
            });
        }

        const allValid = validationResults.every(r => r.valid);

        res.json({
            valid: allValid,
            purchase,
            validationResults
        });
    } catch (error) {
        console.error('Validation error:', error);
        res.status(500).json({ message: 'Validation failed', error: error.message });
    }
};

/**
 * Create a new purchase return
 */
exports.createPurchaseReturn = async (req, res) => {
    try {
        const { purchase_id, items, reason, notes } = req.body;
        const user_id = req.user._id;

        // Validate first
        const validation = await exports.validateReturn(
            { body: { purchase_id, items } },
            { json: (data) => data }
        );

        if (!validation.valid) {
            return res.status(400).json({
                message: 'Validation failed',
                errors: validation.validationResults.filter(r => !r.valid)
            });
        }

        const purchase = await Purchase.findById(purchase_id);

        // Calculate total amount
        let total_amount = 0;
        const returnItems = items.map(item => {
            const purchaseItem = purchase.purchasedItems.find(
                pi => pi.item_id.toString() === item.item_id
            );
            const total_price = item.quantity * purchaseItem.unitCost;
            total_amount += total_price;

            return {
                item: item.item_id,
                variant: item.variant_id,
                quantity: item.quantity,
                unit_price: purchaseItem.unitCost,
                total_price,
                serial_numbers: item.serial_numbers || [],
                original_purchase_item_id: purchaseItem._id
            };
        });

        const purchaseReturn = new PurchaseReturn({
            purchase: purchase_id,
            supplier: purchase.supplier,
            items: returnItems,
            total_amount,
            reason,
            notes,
            created_by: user_id,
            status: 'Pending'
        });

        await purchaseReturn.save();

        res.status(201).json({
            message: 'Purchase return created successfully',
            purchaseReturn
        });
    } catch (error) {
        console.error('Create return error:', error);
        res.status(500).json({ message: 'Failed to create return', error: error.message });
    }
};

/**
 * Get all purchase returns with filters
 */
exports.getPurchaseReturns = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, supplier_id, search } = req.query;

        const query = {};
        if (status) query.status = status;
        if (supplier_id) query.supplier = supplier_id;

        const returns = await PurchaseReturn.find(query)
            .populate('purchase', 'referenceNumber purchaseDate')
            .populate('supplier', 'supplier_name')
            .populate('created_by', 'name')
            .populate('approved_by', 'name')
            .sort({ createdAt: -1 })
            .limit(limit * 1)
            .skip((page - 1) * limit);

        const total = await PurchaseReturn.countDocuments(query);

        res.json({
            returns,
            totalPages: Math.ceil(total / limit),
            currentPage: page,
            total
        });
    } catch (error) {
        console.error('Get returns error:', error);
        res.status(500).json({ message: 'Failed to fetch returns', error: error.message });
    }
};

/**
 * Get single purchase return by ID
 */
exports.getPurchaseReturnById = async (req, res) => {
    try {
        const { id } = req.params;

        const purchaseReturn = await PurchaseReturn.findById(id)
            .populate('purchase')
            .populate('supplier')
            .populate('items.item')
            .populate('created_by', 'name')
            .populate('approved_by', 'name');

        if (!purchaseReturn) {
            return res.status(404).json({ message: 'Purchase return not found' });
        }

        res.json(purchaseReturn);
    } catch (error) {
        console.error('Get return error:', error);
        res.status(500).json({ message: 'Failed to fetch return', error: error.message });
    }
};

/**
 * Approve and process purchase return (reverse stock and payments)
 */
exports.approvePurchaseReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user._id;

        const purchaseReturn = await PurchaseReturn.findById(id).populate('purchase');

        if (!purchaseReturn) {
            return res.status(404).json({ message: 'Purchase return not found' });
        }

        if (purchaseReturn.status !== 'Pending') {
            return res.status(400).json({ message: 'Return already processed' });
        }

        // Reverse stock for each item
        for (const item of purchaseReturn.items) {
            const stockItem = await Item.findById(item.item);

            // Create negative stock ledger entry
            const stockLedger = new StockLedger({
                item_id: item.item,
                variant_id: item.variant,
                purchase_id: purchaseReturn.purchase._id,
                movementType: 'Purchase-Return-Out',
                qty: -item.quantity,
                opening_balance: stockItem.total_quantity,
                closing_balance: stockItem.total_quantity - item.quantity,
                batch_number: `RETURN-${purchaseReturn.return_id}`,
                unitCost: item.unit_price,
                memo: `Purchase return: ${purchaseReturn.return_id} - ${purchaseReturn.reason}`
            });

            await stockLedger.save();

            // Update item stock
            stockItem.total_quantity -= item.quantity;
            await stockItem.save();

            // Handle serialized items
            if (item.serial_numbers && item.serial_numbers.length > 0) {
                for (const serial of item.serial_numbers) {
                    await StockLedger.create({
                        item_id: item.item,
                        variant_id: item.variant,
                        purchase_id: purchaseReturn.purchase._id,
                        serialNumber: serial,
                        movementType: 'Purchase-Return-Out',
                        qty: -1,
                        opening_balance: stockItem.total_quantity,
                        closing_balance: stockItem.total_quantity - 1,
                        batch_number: `RETURN-${purchaseReturn.return_id}`,
                        unitCost: item.unit_price,
                        memo: `Serial return: ${serial}`
                    });
                }
            }
        }

        // Reverse payment if purchase was paid
        const purchase = purchaseReturn.purchase;
        let reversed_amount = 0;

        if (purchase.payment_status === 'Paid' || purchase.payment_status === 'Partial') {
            // Credit supplier account
            const supplier = await Supplier.findById(purchaseReturn.supplier);
            if (supplier && supplier.account) {
                supplier.account.balance += purchaseReturn.total_amount;
                await supplier.save();
                reversed_amount = purchaseReturn.total_amount;
            }

            // Update purchase payment status
            purchase.payment_due_amount += purchaseReturn.total_amount;
            if (purchase.payment_due_amount >= purchase.grand_total) {
                purchase.payment_status = 'Not Paid';
            } else if (purchase.payment_due_amount > 0) {
                purchase.payment_status = 'Partial';
            }
            await purchase.save();
        }

        // Update return status
        purchaseReturn.status = 'Approved';
        purchaseReturn.approved_by = user_id;
        purchaseReturn.approved_date = new Date();
        purchaseReturn.stock_reversed = true;
        purchaseReturn.payment_reversed = reversed_amount > 0;
        purchaseReturn.reversed_amount = reversed_amount;

        await purchaseReturn.save();

        res.json({
            message: 'Purchase return approved and processed successfully',
            purchaseReturn,
            reversed_amount
        });
    } catch (error) {
        console.error('Approve return error:', error);
        res.status(500).json({ message: 'Failed to approve return', error: error.message });
    }
};

/**
 * Reject purchase return
 */
exports.rejectPurchaseReturn = async (req, res) => {
    try {
        const { id } = req.params;
        const { rejection_reason } = req.body;

        const purchaseReturn = await PurchaseReturn.findById(id);

        if (!purchaseReturn) {
            return res.status(404).json({ message: 'Purchase return not found' });
        }

        if (purchaseReturn.status !== 'Pending') {
            return res.status(400).json({ message: 'Return already processed' });
        }

        purchaseReturn.status = 'Rejected';
        purchaseReturn.notes = `${purchaseReturn.notes || ''}\nRejection reason: ${rejection_reason}`;
        await purchaseReturn.save();

        res.json({
            message: 'Purchase return rejected',
            purchaseReturn
        });
    } catch (error) {
        console.error('Reject return error:', error);
        res.status(500).json({ message: 'Failed to reject return', error: error.message });
    }
};
