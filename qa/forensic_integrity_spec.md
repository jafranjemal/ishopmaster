# Forensic Integrity Specification

## 1. The 41-Model Landscape
The iShopMaster domain is organized into 9 overlapping clusters. Data integrity depends on the synchronization between these clusters.

### Cluster 1: Organizational Setup
- `Company`, `Unit`, `Shift`, `User`, `Role`, `Permissions`
- **Integrity Rule:** Only one active company allowed. Shifts must track Cash-In/Out for reconciliation.

### Cluster 2: Master Inventory
- `Items`, `Brand`, `PhoneModel`, `ItemVariantSchema`, `Product`, `Unit`
- **Integrity Rule:** `ItemVariantSchema` must maintain unique attribute strings (e.g., Color-Storage).

### Cluster 3: Stock Management
- `Stock`, `SerializedStock`, `NonSerializedStock`, `StockLedger`, `StockMovement`
- **Integrity Rule:** `StockLedger` must provide a continuous audit trail. Serial numbers must be globally unique across all batches.

### Cluster 4: Supply Chain
- `Supplier`, `Purchase`, `DiscrepancyLog`
- **Integrity Rule:** `Purchase` status "Pending Verification" must lock stock from being sold in POS.

### Cluster 5: Sales & CRM
- `Customer`, `SalesInvoice`, `UnifiedCart`, `Payment`
- **Integrity Rule:** `total_paid_amount` must equal the sum of related `Payment` records.

### Cluster 6: Service & Repairs
- `Ticket`, `Device`, `DeviceInspection`, `JobStatus`, `ReportedIssue`, `WorkOrder`, `RepairOrder`, `PartsUsed`, `ServiceItem`
- **Integrity Rule:** `PartsUsed` must trigger immediate stock decrement or "On Hold" status.

### Cluster 7: Finance & Ledger
- `Account`, `Transaction`, `Payment`
- **Integrity Rule:** `Account.balance` MUST match the latest `Transaction.balance_after_transaction`.

---

## 2. Automated Test Cycle (7 Stages)

| Stage | Action | Validation Target |
| :--- | :--- | :--- |
| **S1: Prep** | RBAC Setup | `User`, `Role`, `Permission` linked |
| **S2: Master** | Create Items & Services | Serialized, Non-Serialized, Service Items (all types) |
| **S3: Supply** | Purchase 10 Units | `Stock` status == "Incoming" (Locked) |
| **S4: Verify** | Inspect & Release | `Stock` status == "Available" |
| **S5: POS** | Sell Item + Service | Mixed billing & Account Ledger |
| **S6: Repair** | Screen Fix (Use Part) | Recursive stock check & Service Charge |
| **S7: Report** | Generate Reports | Debtors, Revenue vs Transactions |
| **S8: Security**| Unauthorized Reversal | Assert: 403 Forbidden |

---

## 3. Critical Edge Cases to Validate
1. **The Overpayer:** Customer pays $1200 for a $1150 phone. $50 must reflect in `Account` (Customer Credit).
2. **The Zombie Serial:** Try to sell a serial number that was marked "Sold" but then the transaction failed midway.
3. **The Verify Lock:** Attempt to sell an item that is still in "Pending Verification" purchase status.
4. **The Ghost Part:** Use a part in a Repair Ticket that was just sold in POS a second earlier.
5. **The Intruder:** A user with 'Cashier' role attempting to 'Verify Purchase' or 'Delete Account' - must fail.
