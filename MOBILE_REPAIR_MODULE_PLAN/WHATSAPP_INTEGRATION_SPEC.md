# WHATSAPP BUSINESS INTEGRATION (MULTI-TENANT ISV MODEL)

## 1. THE CONCEPT: "BRING YOUR OWN NUMBER"
We (JJSOFT) will register as a **Meta Tech Provider**. This allows us to "onboard" other businesses' phone numbers into our app.
- **Tenant**: Owns the Phone Number & WABA (WhatsApp Business Account).
- **JJSOFT**: Owns the App and the API Token to manage their messages.

## 2. ONBOARDING FLOW (EMBEDDED SIGNUP)
This is the official Meta flow for SaaS platforms.

1.  **Merchant Dashboard**: Tenant clicks "Connect WhatsApp".
2.  **Facebook Login Popup**: A Meta-hosted window opens.
    - Tenant logs into Facebook.
    - Selects/Creates their Business Manager.
    - Enters their Phone Number -> Receives SMS Code -> Verifies.
3.  **Token Exchange**: Meta sends us a `system_user_access_token` and `waba_id`.
4.  **Done**: We can now send API requests on their behalf.

## 3. DATA MODEL
We need to store their credentials securely.

### `TenantWhatsAppConfig`
- `tenant_id`: UUID
- `waba_id`: String (WhatsApp Business Account ID)
- `phone_number_id`: String (The ID we send messages from)
- `access_token`: Encrypted String (Never show in UI)
- `business_name`: String
- `template_namespace`: String (For sending approved templates)
- `status`: Enum['CONNECTED', 'DISCONNECTED', 'BANNED']

## 4. TEMPLATE MANAGEMENT
WhatsApp requires "Templates" (e.g., *Your repair #{{1}} is ready*) to be pre-approved.

- **Global Templates**: We create standard templates in our Meta Dashboard.
- **Sharing**: We "share" these templates with Tenant WABAs via API.
- **Result**: All tenants instantly have access to standard "Invoice PDF" and "Repair Status" templates.

## 5. SENDING LOGIC (QUEUE SYSTEM)
Messages must be queued to avoid rate limits.
1. **Event**: `RepairJob.completed`
2. **Action**: `WhatsAppQueue.add({ tenantId, phone: customerPhone, template: 'repair_ready', vars: [jobId] })`
3. **Worker**:
   - Decrypts Tenant Access Token.
   - Calls `POST graph.facebook.com/v19.0/{phone_id}/messages`.
   - Updates `audit_log`.

## 6. BILLING (IMPORTANT)
Meta charges per conversation.
- **Option A (Direct)**: Tenant attaches THEIR credit card to THEIR WABA. (Recommended - Less risk for you).
- **Option B (Re-billing)**: You pay Meta, then bill the Tenant + Margin. (Complex - You risk losing money if they don't pay).

**Recommendation**: Use Option A. The "Embedded Signup" flow asks them to add a payment method to Meta directly.
