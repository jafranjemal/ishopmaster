# VPS ONBOARDING GUIDE: HOSTINGER + COOLIFY

## 1. PRE-REQUISITES
- **Server Name**: `srv1275007.hstgr.cloud`
- **IP**: `72.62.247.138`
- **OS**: Ensure Ubuntu 24.04 (Noble) is selected in Hostinger Panel.

## 2. STEP 1: DNS SETUP (TWO DOMAINS)
Point both domains to your **Same IP**: `72.62.247.138`.

### A. Marketing Domain (.LK)
- **Host `@`**: Point to `72.62.247.138`
- **Host `www`**: Point to `72.62.247.138`

### B. SaaS Domain (.CLOUD)
- **Host `@`**: Point to `72.62.247.138`
- **Host `*`** (Wildcard): Point to `72.62.247.138`

*Wait ~1 hr for propagation.*

## 3. STEP 2: SERVER ACCESS (SSH)
```bash
ssh root@72.62.247.138
```

## 4. STEP 3: COOLIFY INSTALLATION
Run:
```bash
wget -q https://get.coollabs.io/coolify/install.sh -O install.sh; sudo bash install.sh
```

## 5. STEP 4: COOLIFY FIRST LOGIN
1. Open `http://72.62.247.138:8000`.
2. Set Instance Domain to: `https://manage.ishopmaster.cloud`

## 6. STEP 5: SERVICE ROUTING
Inside Coolify, configure your apps like this:

1.  **Marketing App**: 
    - Domain: `https://ishopmaster.lk`
2.  **SaaS Dashboard**: 
    - Domain: `https://*.ishopmaster.cloud`
3.  **Backend API**: 
    - Domain: `https://api.ishopmaster.cloud`

## 7. STEP 6: DEPLOYING THE .LK MARKETING WEBSITE
This is how you make your marketing site live on `ishopmaster.lk`:

1.  **Prepare Repo**: Ensure your marketing website (Next.js, React, or static HTML) is in a separate GitHub repository.
2.  **Create Service**: In Coolify, click **"+ New Resource"** -> **"Public/Private Repository"**.
3.  **Select Repo**: Choose your marketing site repository.
4.  **Configure Domain**: In the "Domains" field, enter `https://ishopmaster.lk, https://www.ishopmaster.lk`.
5.  **Build & Deploy**: Click **"Deploy"**. 
    - Coolify will automatically pull the code, build the project (via Docker), and set up the Let's Encrypt SSL certificate.
6.  **Verify**: Visit `https://ishopmaster.lk` to see your marketing content.

## 7. NEXT STEPS
Once Coolify is running, we can start the **Multi-Tenant Refactor** in the code and push it to GitHub for automatic deployment to this new server.
