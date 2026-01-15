# SMS RESELLER CREDIT SYSTEM (INTERNAL WALLET)

## 1. THE BUSINESS MODEL
- **JJSOFT**: Buys bulk (e.g., 7000 SMS @ 0.40 LKR).
- **Tenant**: Buys packs (e.g., 1000 SMS @ 2.50 LKR).
- **Profit**: You keep the margin (`2.10 LKR` per SMS).

## 2. CORE ARCHITECTURE: THE "SMS WALLET"
We do not charge the tenant's card per SMS. We use a **Prepaid Credit System**.

### Data Models
1.  **TenantWallet**:
    - `tenant_id`: UUID
    - `sms_balance`: Integer (e.g., 450)
    - `reserved_credits`: Integer (for queued messages)

2.  **SmsPackage** (Super Admin defined):
    - `name`: "Startup Pack"
    - `credits`: 1000
    - `price`: 2500.00
    - `currency`: LKR

3.  **SmsTransaction** (Audit):
    - `type`: Enum['TOPUP', 'USAGE', 'REFUND']
    - `amount`: Integer (+1000 or -1)
    - `reference`: "Invoice #123" or "Job #999"

## 3. ENFORCEMENT LOGIC (THE GATEKEEPER)
Before sending *any* SMS, the system runs an ACID transaction:
1.  **Check**: `Wallet.sms_balance > 0`?
2.  **Lock**: Decrement `sms_balance` by 1.
3.  **Send**: Call Gateway API.
4.  **Confirm**: If Gateway fails -> Refund 1 credit.

**Zero Balance Behavior**:
- If `balance == 0`:
  - UI shows "Low SMS Credit" warning.
  - SMS is skipped (log error: `SMS_FAIL_NO_CREDIT`).
  - Admin receives alert: "Tenant X is out of SMS".

## 4. SENDER ID (MASKING) IN SRI LANKA
**Reality Check**: You cannot just "type" a Sender ID like 'MyShop' dynamically in Sri Lanka.
- **Process**: You must submit a letter to the Gateway Provider (Dialog/Mobitel/Notify.lk) for *each* Brand Name.
- **JJSOFT Role**: You collect the request from the tenant -> Submit to Gateway -> Wait 3-5 days -> Enable in Config.
- **Fallback**: Until approved, use a generic ID (e.g., `Alert` or `JJSOFT`).

## 5. REVENUE DASHBOARD (SUPER ADMIN)
- **Total SMS Bought**: 50,000 (Cost: 20k)
- **Total SMS Sold**: 45,000 (Revenue: 112k)
- **Profit**: 92k
- **Usage Heatmap**: Which tenants send the most SMS?
