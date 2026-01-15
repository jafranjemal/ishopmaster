# SAAS AUTOMATED ONBOARDING: THE "MAGIC LINK" ARCHITECTURE

## 1. THE USER EXPERIENCE (UX)
1. **JJSOFT Admin**: Enters email `client@shop.com` -> Clicks "Send Invite".
2. **Client**: Receives email -> Clicks `https://setup.ishopmaster.com?token=xyz`.
3. **Wizard**: Client fills form (Shop Name: "My Mobile Zone", Logo, etc.).
4. **Instant Action**: Client clicks "Launch" -> System redirects to `https://mymobilezone.ishopmaster.com` instantly.

## 2. THE MAGIC: WILDCARD DNS (*)
You do **not** create subdomains manually in DNS for each customer.
Instead, you configure a **Wildcard A Record** once in Cloudflare/GoDaddy.

| Type | Name | Value | TTL |
|---|---|---|---|
| A | * | 192.0.2.1 (Your LB IP) | Auto |
| A | @ | 192.0.2.1 (Your LB IP) | Auto |

**How it works**:
- When someone visits `random-name.ishopmaster.com`, DNS sees the `*` and sends them to your Server IP.
- Your **Nginx/Node.js** app receives the request with header `Host: random-name.ishopmaster.com`.
- Your app checks the DB: "Do we have a tenant with slug `random-name`?"
  - **Yes**: Load that tenant's DB.
  - **No**: Show 404 "Shop Not Found".

## 3. ONBOARDING WORKFLOW (TECHNICAL STEPS)

### Step A: The Invitation
- **Admin**: Generates a signed JWT token containing `{ "role": "owner", "plan": "pro" }`.
- **System**: Sends email with link `https://setup.ishopmaster.com/onboard?token=JWT`.

### Step B: The Setup Wizard
- Client submits optional subdomain: `my-mobile-zone`.
- **Backend Validation**: Checks if `my-mobile-zone` exists in `TenantDomain` collection.
  - *If taken*: "Sorry, allow duplicate? No." -> Prompt user to pick another.

### Step C: Provisioning (The "Launch" Button)
1. **Create Record**: Insert into `TenantAccount`:
   ```json
   {
     "tenant_id": "uuid-123",
     "subdomain": "my-mobile-zone", // Unique Index
     "status": "ACTIVE"
   }
   ```
2. **Provision DB**: `db.createCollection('ishopmaster_uuid-123')` (Lazy creation is also fine).
3. **Redirect**: Send frontend windows.location = `https://my-mobile-zone.ishopmaster.com/login`.

## 4. CUSTOM DOMAIN (CNAME)
If they want `www.mymobilezone.lk` instead of your subdomain:
1. **Instruction**: "Go to your domain provider, add CNAME: `www` -> `domains.ishopmaster.com`".
2. **Our System**: Add to DB: `TenantDomain: { domain: 'www.mymobilezone.lk', tenant_id: 'uuid-123' }`.
3. **Incoming Request**:
   - Browser asks IP for `www.mymobilezone.lk`.
   - DNS says "Ask `domains.ishopmaster.com`".
   - Our Server gets request `Host: www.mymobilezone.lk`.
   - App checks DB -> Finds `uuid-123`.

## 5. SSL AUTOMATION (THE HARD PART)
- **Subdomains**: Use a **Wildcard Certificate** (`*.ishopmaster.com`). One cert covers millions of subdomains.
- **Custom Domains**: Use a Reverse Proxy like **Caddy** or **Traefik**.
  - They automatically talk to Let's Encrypt to generate certificates on-the-fly when a new domain hits your server implementation.
