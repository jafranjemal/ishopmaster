# Forensic Integrity Automation Plan

## Goal
Validate the functional integrity of iShopMaster’s 41 models and 34 controllers through an automated end-to-end "Business Cycle" script. This replaces manual QA with a repeatable proof of correctness.

## Proposed Changes

### [Deep Scan & Mapping]
- Verify relationships between Identity, Inventory, Sales, Repairs, and Finance layers.
- Map the "Company-to-Report" lifecycle.

### [Test Automation]
#### [NEW] [integrityCheck.js](file:///d:/JJSOFT_GLOBAL/MA-Iphone%20Solution/system/ishopmaster-api-before-multi-tenant/ishopmaster-api/scripts/integrityCheck.js)
A standalone Node.js script that:
1. **Initializes** a clean test state (or uses a dedicated test prefix).
2. **Executes** the 7-Stage Business Cycle:
   - **Stage 1 (System Prep):** Validate existing Company. Create Roles (Admin, Cashier, Technician), Permissions, and Users.
   - **Stage 2 (Deep Master Data):** 
     - Create **Categories** (Mobile, Accessory, Service).
     - Create **Items**: Serialized (Phones), Non-Serialized (Chargers), Variants (Colors/Storage).
     - Create **Service Items**: Screen Repair, Battery Replacement (with linked standard charges).
   - **Stage 3 (Supply Chain):** Purchase Order for multi-type items -> Verification (Stock Lock & Security Test).
   - **Stage 4 (POS / Sales):** Shift Start -> Cart (Item + Service) -> Partial Payment (Transaction validation).
   - **Stage 5 (Repair Lifecycle):** Ticket -> Device Inspection -> Part Consumption (from stock) -> Service Billing.
   - **Stage 6 (Reversal & Return):** Full Return of Item -> Stock Restoration -> Warranty Auto-Void.
   - **Stage 7 (Financial Reconciliation):** Generate Debtors, Revenue, and Profit Reports -> Cross-check against Ledger.
   - **Stage 8 (Negative Testing):** Unauthorized access role-play (Cashier trying to delete Purchase).

## Verification Plan
### Automated Verification
- Run `node scripts/integrityCheck.js`.
- Script will output a detailed pass/fail log for each sub-transaction.
- Assert that `Transaction.balance_after_transaction` == `Account.balance`.
- Assert that `SerializedStock.status` matches the `SalesInvoice.status`.

### Manual Audit
- Review the generated `forensic_integrity_spec.md` for logic coverage.
- Inspect the logs for state-change delays or race conditions during the simulated POS cycle.
