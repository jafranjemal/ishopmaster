# ZERO-COST DEPLOYMENT STACK (VPS + COOLIFY)

## 1. THE STRATEGY
We replace Render/Netlify with **Coolify**.
- **Coolify** is an open-source "Heroku" that you host yourself.
- It automates: CI/CD, SSL Certificates, Database Backups, and Reverse Proxying.
- **Cost**: $0 (Free Software). You only pay for the generic VPS ($5-$6/mo).

## 2. HARDWARE (VPS)
Provider: **Hetzner** (Recommended) or DigitalOcean / Linode.
- **Spec**: CPX11 (Hetzner) or Basic Droplet.
- **RAM**: 4GB Minimum (Required for MongoDB + Node + Redis + Coolify).
- **Control Panel**: None (We use Coolify).
- **OS**: Ubuntu 24.04 LTS.

## 3. THE STACK (ALL DOCKERIZED)
1.  **Frontend**: React (Built as static Docker image).
2.  **Backend**: Node.js/NestJS (Docker container).
3.  **Database**: MongoDB (Self-hosted container).
4.  **Cache**: Redis (Self-hosted container).
5.  **Proxy**: Traefik (Built-in to Coolify) -> Handles Wildcard SSL (`*.shop.com`) automatically.

## 4. SETUP STEPS

### Step A: Install Coolify
Run one command on your fresh VPS:
```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```
Visit `http://your-ip:8000` -> Login.

### Step B: Connect GitHub
1.  In Coolify, add your "GitHub Private Repository".
2.  Tick "Autodeploy".
3.  **Result**: Every time you push to `main`, Coolify pulls user code -> builds Docker image -> deploys. **(Free CI/CD)**.

### Step C: Configure Wildcard Domains
1.  In DNS (Cloudflare): Point `*` and `@` to your VPS IP.
2.  In Coolify (Backend Service): Set Domains to `https://api.ishopmaster.com`.
3.  In Coolify (Frontend Service): Set Domains to `https://ishopmaster.com, https://*.ishopmaster.com`.
4.  **Magic**: Coolify asks Let's Encrypt for certificates automatically.

## 5. CI/CD PIPELINE (GitHub Actions)
For advanced control (e.g., running tests before deploy):
- Create `.github/workflows/deploy.yml`:
  ```yaml
  name: Deploy
  on: [push]
  jobs:
    test:
      runs-on: ubuntu-latest
      steps:
        - uses: actions/checkout@v3
        - run: npm install && npm test
    deploy:
      needs: test
      runs-on: ubuntu-latest
      steps:
        - run: curl "https://coolify.ishopmaster.com/api/webhooks/deploy?uuid=..."
  ```

## 6. BACKUP STRATEGY (FREE)
- **Coolify Built-in**: Schedule "S3 Backups" for MongoDB.
- **Destinations**: Use AWS S3 (Free Tier) or Cloudflare R2 (Free Tier) or MinIO (Self-hosted).

## 7. DUAL-DOMAIN ARCHITECTURE (BEST PRACTICE)
Using separate domains for your **Marketing (.lk)** and **SaaS Platform (.cloud)** is a professional-grade strategy.

### The Logic
- **`ishopmaster.lk`**: High trust, perfect for Sri Lankan marketing and SEO.
- **`ishopmaster.cloud`**: Clean, technical, and perfect for global SaaS subdomains (e.g., `izone.ishopmaster.cloud`).

### Technical Setup

#### Step 1: DNS Configuration
Point both domains to your VPS IP: `72.62.247.138`.

| Domain | Record Type | Host | Points To |
|---|---|---|---|
| **ishopmaster.lk** | A | @ | `72.62.247.138` |
| **ishopmaster.lk** | A | www | `72.62.247.138` |
| **ishopmaster.cloud** | A | @ | `72.62.247.138` |
| **ishopmaster.cloud** | A | * | `72.62.247.138` |

#### Step 2: Coolify Service Routing
1.  **Marketing App**: Set domain to `https://ishopmaster.lk`.
2.  **SaaS App**: Set domain to `https://*.ishopmaster.cloud`.

### Benefits
- **Security**: Cookies from your app (`.cloud`) won't be shared with your marketing site (`.lk`).
- **Branding**: The `.cloud` extension tells customers this is a "Web System".
- **Safety**: If a tenant misuses `client.ishopmaster.cloud`, it won't hurt the search engine ranking of your main `ishopmaster.lk` site.
