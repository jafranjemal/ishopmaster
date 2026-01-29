const mongoose = require("mongoose");
const connectDB = require("../db/db");
const Account = require("../models/Account");
const PaymentSettings = require("../models/PaymentSettings");
const Transaction = require("../models/Transaction");
const Payment = require("../models/Payment");
const fs = require("fs");

const paymentController = require("../controllers/paymentController");

const LOG_FILE = "verification_results.txt";

function log(msg) {
    console.log(msg);
    try {
        fs.appendFileSync(LOG_FILE, msg + "\n");
    } catch (e) {
        console.error("Error writing to log file:", e);
    }
}

async function runTests() {
    try {
        fs.writeFileSync(LOG_FILE, "Starting Verification...\n");
    } catch (e) {
        console.error("Error initializing log file:", e);
    }

    log("Starting Accounting Verification...");
    await connectDB();

    try {
        // --- CLEANUP START ---
        // Clean any leftovers from previous failed runs
        await Account.deleteMany({ account_name: { $regex: /Mock/ } });
        await PaymentSettings.deleteMany({ method_name: { $regex: /Mock/ } });

        log("\n[SETUP] Creating Mock Accounts...");

        // 1. Supplier Account (Liability)
        let supplierAcc = await Account.create({
            account_name: "Mock Supplier",
            account_type: "Payable",
            account_owner_type: "Supplier",
            related_party_id: new mongoose.Types.ObjectId(),
            balance: 1000
        });

        // 2. Company Cash (Asset)
        let cashAcc = await Account.create({
            account_name: "Mock Cash Drawer",
            account_type: "Cash",
            account_owner_type: "Company",
            related_party_id: new mongoose.Types.ObjectId(),
            balance: 5000
        });

        // 3. Company Bank (Asset)
        let bankAcc = await Account.create({
            account_name: "Mock Bank",
            account_type: "Bank",
            account_owner_type: "Company",
            related_party_id: new mongoose.Types.ObjectId(),
            balance: 20000
        });

        log(`Supplier Balance: ${supplierAcc.balance}`);
        log(`Cash Balance: ${cashAcc.balance}`);
        log(`Bank Balance: ${bankAcc.balance}`);

        // --- TEST 1: LIABILITY LOGIC ---
        log("\n[TEST 1] Testing Liability Logic (Paying Supplier)...");
        // Paying 200 to Supplier. Should Decrease Liability.
        const req1 = {
            body: {
                amount: 200,
                from_account_id: cashAcc._id,
                to_account_id: supplierAcc._id,
                transaction_type: "Supplier Payment",
                references: { supplier: supplierAcc._id, purchase_orders: [] },
                description: "Test Liability Pay"
            }
        };
        const res1 = {
            status: (code) => ({ json: (data) => log(`Result: Status ${code} - ${data.message}`) })
        };

        await paymentController.addPayment(req1, res1);

        const supplierAfter = await Account.findById(supplierAcc._id);
        const cashAfter = await Account.findById(cashAcc._id);

        log(`Expected Supplier Balance: 800 | Actual: ${supplierAfter.balance}`);
        if (supplierAfter.balance === 800) log("✅ LIABILITY LOGIC PASS");
        else log("❌ LIABILITY LOGIC FAIL - Balance increased instead of decreased?");

        log(`Expected Cash Balance: 4800 | Actual: ${cashAfter.balance}`);

        // --- TEST 2: SPLIT PAYMENT MAPPING ---
        log("\n[TEST 2] Testing Payment Mapping Routing...");

        // Use MockCash to avoid conflict with real "Cash"
        await PaymentSettings.create({ method_name: "MockVisa", account_id: bankAcc._id });
        await PaymentSettings.create({ method_name: "MockCash", account_id: cashAcc._id });

        const custAcc = await Account.create({
            account_name: "Mock Customer",
            account_type: "Customer",
            account_owner_type: "Customer",
            related_party_id: new mongoose.Types.ObjectId(),
            balance: 0
        });

        const req2 = {
            body: {
                amount: 500,
                from_account_id: custAcc._id,
                payment_methods: [
                    { method: "MockCash", amount: 100 },
                    { method: "MockVisa", amount: 400 }
                ],
                transaction_type: "Sale",
                references: {},
                description: "Test Split Sale"
            }
        };

        await paymentController.addPayment(req2, res2 = {
            status: (code) => ({
                json: (data) => log(`[TEST 2 RESULT] Status ${code} - ${data.message} ${data.error ? '- ' + data.error : ''}`)
            })
        });

        const bankAfter = await Account.findById(bankAcc._id);
        const finalCash = await Account.findById(cashAcc._id);

        log(`Expected Bank Balance: 20400 (+400) | Actual: ${bankAfter.balance}`);
        if (bankAfter.balance === 20400) log("✅ VISA MAPPING PASS");
        else log("❌ VISA MAPPING FAIL");

        log(`Expected Cash Balance: 4900 (4800 + 100) | Actual: ${finalCash.balance}`);
        if (finalCash.balance === 4900) log("✅ CASH MAPPING PASS");
        else log("❌ CASH MAPPING FAIL");

        // --- VALIDATION OF ABSOLUTE AMOUNTS ---
        log("\n[TEST 3] Verifying Absolute Transaction Amounts...");
        const txs = await Transaction.find({ account_id: supplierAcc._id }).sort({ _id: -1 }).limit(1);
        if (txs.length > 0) {
            log(`Supplier Transaction Amount: ${txs[0].amount} (Should be Positive)`);
            if (txs[0].amount > 0) log("✅ ABSOLUTE AMOUNT PASS");
            else log("❌ ABSOLUTE AMOUNT FAIL");
        } else {
            log("❌ ABSOLUTE AMOUNT FAIL - No Transaction Found");
        }

        log("\n[CLEANUP] Removing Mock Data...");
        await Account.deleteMany({ account_name: { $regex: /Mock/ } });
        await PaymentSettings.deleteMany({ method_name: { $regex: /Mock/ } });

    } catch (err) {
        log("TEST SUITE ERROR: " + err.message);
        console.error(err);
    } finally {
        log("Done.");
        process.exit(0);
    }
}

runTests();
