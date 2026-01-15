# FUTURE PLAN: WHITE-LABEL REPAIR MARKETPLACE

## CONCEPT
Convert the backend into a headless engine powering custom-branded storefronts (e.g., `izonemobile.lk`) on top of the `ishopmaster` core.

## 1. TECHNICAL TERMS
- **Multi-tenant SaaS**: Shared code, isolated data.
- **CNAME Mapping**: Mapping custom domains to tenant ID via HTTP Host headers.
- **Edge SSL**: Automated SSL (Let's Encrypt) via reverse proxy (Nginx/Traefik).
- **Dynamic Theming**: runtime CSS generation based on `ThemeConfig`.

## 2. SYSTEM ESTIMATES
- **New Models (8)**: `MarketplaceConfig`, `ThemeSetting`, `ShopPage`, `PublicInquiry`, `ServiceAppointment`, `WebOrder`, `GuestCustomer`, `DomainMapping`.
- **Modified Models (3)**: `RepairJob` (JobSource link), `PhoneModel` (SEO metadata), `Item` (WebVisibility toggle).
- **Core Services (4)**: `CMSManager`, `BookingEngine`, `PriceCalculator`, `OrderSyncService`.
- **Controllers (3)**: `MarketplaceAPI` (Public), `ShopAdminAPI` (CMS), `DomainGateway`.

## 3. CORE BUSINESS LOGICS
- **Zero-Trust Booking**: Public inquiries remain in `PENDING` until store staff "Converts to Job".
- **Real-time Price Engine**: Fetches `bundle_price` but adds "Marketplace Service Fee" if configured.
- **Header Hijacking**: Middleware reads `x-original-host` to resolve which shop's data to show.
- **Stock Lock**: Web orders create a 15-min `SoftReservation` to prevent overselling.

## 4. IMPLEMENTATION ROADMAP

### Phase 1: The Gateway (Weeks 1-3)
- **Start Point**: Implement `TenantResolver` middleware.
- **End Point**: A blank page served on `customshop.com` showing the shop's logo from the DB.
- **Task**: `DomainMapping` model and Nginx CNAME orchestration.

### Phase 2: Headless Catalog (Weeks 4-6)
- **Start Point**: Public API for Brand/Model/Service lookup.
- **End Point**: A functional "Price Calculator" on the website.
- **Task**: `PriceCalculator` service and `web_visibility` flag logic.

### Phase 3: Transactional Web (Weeks 7-10)
- **Start Point**: `ServiceAppointment` model and scheduling logic.
- **End Point**: Customer receives email confirmation for a booking at `IzonedMobile`.

## 5. TEST CASES
- **Isolation**: Shop A's price change must NOT affect Shop B on different domains.
- **Branding**: Verify `primary_color` HEX code updates accurately on the UI without rebuild.
- **Scale**: Verify 50 simultaneous domain mappings load in <200ms.

## 6. TEST PLAN
- **Custom Domain Test**: Verify `shop1.com` sees only `Shop1` stock.
- **Branding Test**: Verify CSS variables inject correct colors per domain.
- **Concurrency Test**: 10 simultaneous bookings for same technician.
- **SEO Test**: Verify meta-tags are unique per domain.
