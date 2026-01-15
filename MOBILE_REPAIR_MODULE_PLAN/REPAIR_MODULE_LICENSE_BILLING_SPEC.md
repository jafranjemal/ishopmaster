# LICENSE & BILLING ARCHITECTURE SPECIFICATION

## 1. THE "JJSOFT ADMIN" WORKFLOW
Unlike self-serve SaaS, this is a **Managed B2B Service**.
1. **Sales Rep (You)**: Negotiates deal (e.g., "1 Year for $1000, 50% down").
2. **Admin Portal**: You click "New Contract".
   - Select Plan: `Gold Tier`
   - Price Override: `$1000` (Discounted from $1200)
   - Payment Terms: `Split - 2 Installments`
   - Contract Start: `Today`
3. **Magic Link**: System generates `setup.ishopmaster.com/invite?token=SECURE` sent to client.

## 2. DATA MODELS

### `LicenseContract`
- `contract_id`: UUID
- `tenant_id`: UUID
- `status`: Enum['ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED']
- `start_date`: Date
- `expiry_date`: Date
- `grace_period_days`: Integer (default: 7)
- `total_contract_value`: Decimal
- `payment_terms`: Enum['UPFRONT', 'MONTHLY', 'INSTALLMENTS']

### `PaymentRecord`
- `record_id`: UUID
- `contract_id`: UUID
- `amount_due`: Decimal
- `amount_paid`: Decimal
- `due_date`: Date
- `payment_method`: Enum['CASH', 'CHEQUE', 'ONLINE']
- `collection_agent`: String (e.g., "Field Rep Name")
- `cheque_details`: Object ({ number, bank, date })
- `status`: Enum['PENDING', 'PAID', 'OVERDUE', 'BOUNCED']

## 3. ENFORCEMENT LOGIC (THE "KILL SWITCH")
Middleware `LicenseGuard` runs on every request:
1. **Active**: `expiry_date > now` -> ALLOW.
2. **Grace Period**: `expiry_date < now < expiry + 7 days` -> ALLOW + SHOW BANNER ("Payment Due!").
3. **Suspended**: `now > expiry + 7 days` -> BLOCK (402 Payment Required).
   - *Exception*: Allow `/billing` and `/login` (for Read-Only access if configured).

## 4. CASH & CHEQUE MANAGEMENT
Since manual payments are common:
- **Reminders**: System emails/SMS Admin 3 days before Cheque Date.
- **Collection View**: "Today's Collections" dashboard for field reps.
- **Receipts**: Auto-generate PDF Receipt only when Admin clicks "Mark Paid".

## 5. INSTALLMENT LOGIC
Example: $1000 Deal, 50% now, 50% in 6 months.
- **Contract Created**: Status `ACTIVE`.
- **Payment 1**: $500 Due Now. (If unpaid -> Block immediately).
- **Payment 2**: $500 Due Date = `Start + 6 Months`.
  - System auto-schedules this logic.
  - If Payment 2 missed -> Contract enters `GRACE_PERIOD` -> `SUSPENDED`.

## 6. CLIENT UI (BILLING PORTAL)
- **Dashboard Widget**: "License Valid Until: Dec 31, 2026".
- **Alerts**: Red banner if `PaymentRecord.status == 'OVERDUE'`.
- **Action**: "Request Extension" button (Sends WhatsApp msg to JJSoft).

## 7. AUTOMATED ALERTS
- **T-30 Days**: "Your license expires soon. Contact support."
- **T-7 Days**: "Urgent: Service suspension imminent."
- **T+1 Day (Grace)**: "Service running on grace period."

## 8. DIGITAL CONTRACT SIGNING (LEGAL COMPLIANCE)
To ensure the contract is legally binding before any setup occurs.

### The "Sign-First" Workflow
1. **Landing**: Client clicks Magic Link -> Sees "Contract Preview" (PDF).
2. **Review**: Terms & Conditions embedded directly in the view.
3. **Identity Action**: Client enters Full Name + NIC/ID Number.
4. **Signature**: Draws signature on touch/mouse pad (via `react-signature-canvas`).
5. **Freeze**: System generates a **Digitally Signed PDF** with:
   - Flattened Signature Image.
   - Timestamp + IP Address watermark on every page.
   - "Digitally Signed by [Name] on [Date]" footer.
6. **Storage**: PDF stored in immutable S3 bucket `contracts/{year}/{id}_signed.pdf`.
7. **Provisioning**: ONLY after signature upload does the "Setup Shop" button unlock.

### Legal Audit Data
For a signature to be admissible in court, we capture:
- **Signer Identity**: Name, ID Number, Email.
- **Intent**: Checkbox "I agree to be legally bound by these terms".
- **Integrity**: Hash of the PDF content (SHA-256) stored in DB.
- **Audit Trail**:
  - `accessed_at`: 2026-01-15 10:00:00 (IP: 202.1.1.1)
  - `signed_at`: 2026-01-15 10:05:30 (IP: 202.1.1.1)
