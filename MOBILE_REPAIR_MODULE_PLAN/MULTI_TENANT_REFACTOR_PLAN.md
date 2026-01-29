# FUTURE UPGRADE: MULTI-TENANT REFACTORING PLAN

## 1. STRATEGIC OBJECTIVE
Transform the monolithic monolithic architecture into a **Shared-Code, Isolated-Data** SaaS platform. This requires strict decoupled layers and dynamic database routing.

## 2. ARCHITECTURAL CHANGES

### Standard Request Lifecycle:
`Public/Custom Domain` -> `Cloudflare/Nginx` -> `TenantResolverMiddleware` -> `Controller` -> `Service` -> `Repository` -> `Tenant-Specific DB`.

### Key Structural Patterns:
- **Slim Controllers**: No business logic. Responsible only for `Request` parsing and `Response` status codes.
- **Fat Services**: Pure domain logic. Communicates with `Repositories` using a scoped DB connection.
- **AsyncLocalStorage**: For propagating `tenantContext` across the call stack without manual passing.

## 3. NEW INFRASTRUCTURE COMPONENTS
- **TenantResolver**: Middleware to extract `tenantId` from Subdomain/Host.
- **DatabaseManager**: A cache-enabled service that manages tenant contexts.
  - **Optimization**: Use `mongoose.connection.useDb(tenantDbName, { useCache: true })` for tenants sharing the same MongoDB cluster.
  - **Lazy Registration**: Definitions are registered on the tenant connection *only when first requested* to prevent startup bloat.
  - **Lifecycle Management**: Implement an LRU cache for connections; close inactive tenant connections after ~15–30 minutes of idle time to reclaim resources.

## 4. IMPLEMENTATION PHASES

### Phase 1: Core Infrastructure (Wk 1-2)
- [ ] Implement `TenantContext` using `AsyncLocalStorage`.
- [ ] Implement `ConnectionPool` manager.
- [ ] Create `MultiTenantSchema` wrapper to register models per-connection.

### Phase 2: Controller-Service Decoupling (Wk 3-6)
- [ ] **Inventory Module**: Move all logic from `itemController` to `ItemService`.
- [ ] **Sales Module**: Refactor `salesController` into `SalesService` (Saga-ready).
- [ ] **Repair Module**: Implement new `RepairService` with Quality Tier logic.
- [ ] **Auth Module**: Update to handle cross-tenant login or global super-admin.

### Phase 3: Headless API Standards (Wk 7-8)
- [ ] Implement standardized error handlers.
- [ ] Implement Request Validation (Zod/Joi) in the Controller layer.
- [ ] Setup API Versioning (`/api/v2/`).

## 5. BUSINESS LOGIC RULES
- **Tenant Isolation**: Queries must NEVER cross-database.
- **Global Data**: Keep a "System DB" for global configurations and Master Data (Brands, Models) if shared.
- **Idempotency**: All services must support idempotency keys to prevent duplicate operations in a distributed system.

## 6. TEST PLAN (LEAKAGE PREVENTION)
- **Automated Isolation Test**: (MANDATORY) Part of CI/CD. Script generates two mock tenants, inserts identical-ID records into both, and verifies Tenant A cannot `find()` Tenant B's data.
- **Load Test**: Verify connection pool stability with 500+ active logical database switches.
- **Refactor Test**: Ensure 100% unit test coverage for `Services` after logic extraction.

## 7. DEVELOPMENT STRATEGY (LOCAL TESTING)
Since local environments lack subdomains, use the following tiered approach:

### 1. Header-Based Routing (Priority 1)
- Add middleware to check for `X-Tenant-ID` or `X-Tenant-Domain` header.
- Use Postman/Insomnia to manually inject headers during API development.

### 2. Local DNS (Hosts File)
- Map local subdomains to localhost:
  ```text
  127.0.0.1 shop1.localhost
  127.0.0.1 shop2.test
  ```
- No DNS server required; browsers will resolve these locally.

### 3. Default Tenant Mode
- Set an `.env` variable `DEV_DEFAULT_TENANT=izonemobile`.
- Middleware uses this if no subdomain or header is detected.

### 4. Database Seeding (Isolated)
- Dev script `npm run seed:tenant --name=shop1` creates `ishopmaster_shop1` DB.
- Prevents development data from bloating the primary system DB.

## 8. SYSTEM MANAGEMENT PLANE (SUPER ADMIN)
A dedicated "Management Context" is required for operating the platform itself.

### Architecture
- **System DB**: `ishopmaster_system` (Global). Separation from Tenant DBs is mandatory.
- **Super Models**: `TenantAccount`, `SubscriptionPlan`, `LicenseKey`, `SystemUser`, `BackupAudit`.

### Core Workflows
1.  **Onboarding**:
    - "Create Tenant" wizard -> Provisions `ishopmaster_{tenant_id}` DB.
    - Seeds default admin user + standard roles.
    - Generates `LicenseKey` and binds via `SystemSettings`.

2.  **Lifecycle Management**:
    - **Suspension**: `TenantAccount.status = 'SUSPENDED'`. Middleware blocks all requests (403 Payment Required).
    - **Blocking**: Block access by IP/Region via `SystemFirewall`.
    - **Offboarding**: Soft-delete tenant -> Scheduled DB dump to Cold Storage -> Drop DB.

3.  **Disaster Recovery (Self-Service)**:
    - **Backup**: Trigger `mongodump` via Job Queue -> Upload to S3 `backups/{tenant_id}/`.
    - **Point-in-Time Restore**: "Restore" button triggers `mongorestore` to a temporary DB -> Verification -> Swap with Live DB.
    - **Audit**: Log all admin actions to `SystemAuditLog` (immutable).

### Admin Portal
A separate React App (or Admin Route) strictly for JJSOFT staff:
- **Dashboard**: Active Tenants, MRR, Server Load.
- **Tenant Detail**: "Login as Tenant" (Impersonation), billing history, error logs.

## 9. REDIS PERFORMANCE LAYER (FREE SELF-HOSTED)
To achieve <50ms POS search responses, we will deploy a self-hosted Redis instance (Zero Cost).

### Architecture
- **Installation**: Run Redis on the same VPS (or dedicated RAM node) via Docker/Native.
- **Client**: Use `ioredis` library for cluster-ready connections.

### Caching Strategy (Speed Optimization)
1.  **POS Product Search (The "Hot" Cache)**:
    - **Key**: `tenant:{id}:products:search_index`
    - **Structure**: Plain **Redis HASH** where field is `product_id` and value is `JSON.stringify(productData)`.
    - **Search logic**: For complex filters, use **Sorted Sets** (ZSET) to store searchable terms (e.g., brand:iphone) mapped to IDs.
    - **Flow**: POS Search -> Check Redis -> (Hit? Parse JSON + Return) -> (Miss? DB Query + Write to Redis).
    - **Invalidation**: On product update/stock change -> Delete Key.

2.  **Stock Availability**:
    - **Key**: `tenant:{id}:stock:{sku}`
    - **Structure**: Simple **Redis STRING**.
    - **Usage**: Use `DECRBY` / `INCRBY` atomic operations for real-time counters.
    - **Benefit**: Prevents DB locking during high-traffic sales.

3.  **Tenant Resolution**:
    - **Key**: `domain:{shop.com}` -> **Value**: `tenant_uuid`.
    - **Benefit**: Eliminates the "Lookup Tenant" DB query on *every single request*.

4.  **Session Store**:
    - Migrate from JWT-only to Redis-backed sessions for instant "Global Logout" capability (Security).
