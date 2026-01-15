# MOBILE REPAIR MODULE IMPLEMENTATION SPECIFICATION
## COMPLETE DOMAIN & FINANCIAL DESIGN

## DOMAIN OVERVIEW

Greenfield bounded context for ERP-grade mobile repair management. Integrates with existing inventory models (Item, ItemVariant, Purchase, SerializedStock, NonSerializedStock) through reference-only coupling.

### CORE PRINCIPLES

1. **No Ad-Hoc Repairs**: All repairs derive from pre-defined service templates
2. **Immutable Financial Records**: Cost/price snapshots immutable after job approval
3. **Inventory Isolation**: Repair allocations reference but don't modify existing inventory
4. **Audit Trail Completeness**: Every state transition and financial calculation recorded
5. **FIFO Enforcement**: Non-serialized inventory follows automatic FIFO allocation
6. **Quality Tier Integration**: Pricing and warranty periods are driven by part quality (OEM/Aftermarket/Generic)

## ENTITIES WITH UPDATED STATUS ENUMS

### repair_service_category (unchanged)
```markdown
- category_id: UUID (immutable)
- category_code: String (unique, immutable, max 20)
- category_name: String (required, max 100)
- parent_category_id: UUID (nullable, ref: repair_service_category)
- risk_level: Enum['LOW', 'MEDIUM', 'HIGH'] (required)
- is_active: Boolean (default: true)
- created_at: DateTime (auto)
- updated_at: DateTime (auto)
```

### repair_service_template
```markdown
- template_id: UUID (immutable)
- template_code: String (unique, immutable, max 30)
- template_name: String (required, max 150)
- service_category_id: UUID (ref: repair_service_category, required)
- service_type: Enum['LABOR_ONLY', 'PARTS_ONLY', 'MIXED'] (required)
- requires_diagnosis: Boolean (default: false)
- requires_parts: Boolean (default: false)
- default_warranty_days: Integer (min: 0, max: 365)
- default_skill_level: Enum['BASIC', 'INTERMEDIATE', 'ADVANCED'] (required)
- risk_classification: Enum['LOW', 'HIGH'] (required)
- has_multi_stage_workflow: Boolean (default: false)
- workflow_template_id: UUID (nullable)
- is_active: Boolean (default: true)
- price_valid_until: DateTime (nullable, triggers review when expired)
- created_at: DateTime (auto)
- updated_at: DateTime (auto)

Price Revision Rules:
- Cost variance >20% triggers alert
- price_valid_until expiry blocks new quotations
- Manager approval required for price updates
- Old pricing marked deprecated (not deleted)
```

### repair_service_model_pricing (NEW)
```markdown
- pricing_id: UUID (immutable)
- service_template_id: UUID (ref: repair_service_template, required)
- phone_model_id: UUID (ref: PhoneModel, required)
- quality_tier_id: UUID (ref: repair_part_quality_tier, required)
- labor_charge: Decimal (required, precision: 10, scale: 2)
- parts_estimate: Decimal (required, precision: 10, scale: 2)
- bundle_price: Decimal (required, precision: 10, scale: 2)
- duration_minutes: Integer (required, min: 1)
- is_active: Boolean (default: true)
- valid_from: DateTime (default: now)
- valid_to: DateTime (nullable)
- created_at: DateTime (auto)
- updated_at: DateTime (auto)

Constraint: Unique(service_template_id, phone_model_id, quality_tier_id)
```

### repair_customer_device (with intake governance)
```markdown
- customer_device_id: UUID
- customer_id: UUID (ref: Customer, required)
- brand_id: UUID (ref: Brand, required)
- model_id: UUID (ref: PhoneModel, required)
- imei_or_serial: String (unique, required, max 50)
- ownership_verified: Boolean (default: false)
- ownership_verification_method: Enum['ID', 'RECEIPT', 'WARRANTY', 'OTHER'] (nullable)
- ownership_verification_date: DateTime (nullable)
- data_consent_given: Boolean (default: false)
- data_consent_timestamp: DateTime (nullable)
- initial_condition_snapshot: Object (required)
- initial_condition_images: [String] (max 5 URLs)
- risk_flag: Boolean (default: false)
- risk_reason: String (nullable, max 255)
- legal_hold: Boolean (default: false)
- legal_hold_reason: String (nullable, max 255)
- created_at: DateTime (auto)
- updated_at: DateTime (auto)
```

### repair_job (with resolved status enums)
```markdown
- repair_job_id: UUID
- customer_device_id: UUID (ref: repair_customer_device, required)
- intake_reference_id: String (required, max 50)
- current_status: Enum['QUOTATION', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED', 'CANCELLED'] (ABANDONED removed)
- risk_flag: Boolean (default: false)
- legal_hold: Boolean (default: false)
- total_quoted_amount: Decimal (nullable, precision: 10, scale: 2)
- total_approved_amount: Decimal (nullable, precision: 10, scale: 2)
- total_final_amount: Decimal (nullable, precision: 10, scale: 2)
- created_at: DateTime (auto)
- approved_at: DateTime (nullable)
- started_at: DateTime (nullable)
- completed_at: DateTime (nullable)
- delivered_at: DateTime (nullable)
- cancelled_at: DateTime (nullable)
```

### repair_part_quality_tier
```markdown
- quality_tier_id: UUID
- tier_code: String (unique, 'OEM', 'AFTERMARKET', 'GENERIC')
- tier_name: String (required)
- warranty_multiplier: Decimal (1.0 for OEM, 0.7 for aftermarket, 0.5 for generic)
- is_active: Boolean (default: true)
```

### repair_service_required_part (NEW)
```markdown
- required_part_id: UUID
- service_template_id: UUID (ref: repair_service_template, required)
- quality_tier_id: UUID (ref: repair_part_quality_tier, required)
- item_id: UUID (ref: Item, required)
- variant_id: UUID (ref: ItemVariant, nullable)
- quantity: Decimal (required, min: 0.01)
- is_optional: Boolean (default: false)
- created_at: DateTime (auto)

Constraint: Unique(service_template_id, quality_tier_id, item_id, variant_id)
```

### repair_part_alternative
```markdown
- alternative_id: UUID
- required_part_id: UUID (ref: repair_service_required_part)
- item_id: UUID (ref: Item, required)
- variant_id: UUID (ref: ItemVariant, nullable)
- quality_tier_id: UUID (ref: repair_part_quality_tier, required)
- price_adjustment: Decimal (+ or - from default price)
- is_default: Boolean (default: false, only one default per required_part)
- requires_approval: Boolean (default: false)
- created_at: DateTime (auto)

Substitution Rules:
- Customer must approve non-default alternatives
- Warranty period adjusted by quality_tier.warranty_multiplier
- Price recalculated on substitution
- Substitution logged in audit trail
```

### repair_job_service (unchanged)
```markdown
- job_service_id: UUID
- repair_job_id: UUID (ref: repair_job, required)
- pricing_id: UUID (ref: repair_service_model_pricing, required)
- selected_quality_tier_id: UUID (ref: repair_part_quality_tier, required)
- service_snapshot: Object (required, immutable)
- approved_price: Decimal (required, precision: 10, scale: 2)
- actual_price: Decimal (nullable, precision: 10, scale: 2)
- status: Enum['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'] (required)
- technician_id: UUID (ref: Employees, nullable)
- assigned_at: DateTime (nullable)
- started_at: DateTime (nullable)
- completed_at: DateTime (nullable)
- failed_at: DateTime (nullable)
- failure_reason: String (nullable, max 255)
- quality_check_passed: Boolean (nullable)
- quality_check_notes: String (nullable, max 500)
```

### repair_job_part (with cost snapshotting)
```markdown
- job_part_id: UUID
- job_service_id: UUID (ref: repair_job_service, required)
- item_id: UUID (ref: Item, required)
- variant_id: UUID (ref: ItemVariant, nullable)
- actual_quality_tier_id: UUID (ref: repair_part_quality_tier, required)
- tier_change_reason: String (nullable)
- quantity: Decimal (min: 0.01, precision: 10, scale: 3)
- unit_cost_snapshot: Decimal (required, precision: 10, scale: 2, immutable after consumption)
- total_cost_snapshot: Decimal (required, precision: 10, scale: 2, immutable after consumption)
- charge_snapshot: Decimal (required, precision: 10, scale: 2)
- allocation_method: Enum['FIFO', 'SERIALIZED'] (required)
- consumed_at: DateTime (default: now)
- notes: String (nullable, max 255)
```

### repair_part_allocation (concrete inventory integration)
```markdown
- allocation_id: UUID
- job_part_id: UUID (ref: repair_job_part, required)
- stock_reference_type: Enum['SERIALIZED', 'NON_SERIALIZED'] (required)
- serialized_stock_id: UUID (ref: SerializedStock, nullable)
- non_serialized_stock_id: UUID (ref: NonSerializedStock, nullable)
- purchase_id: UUID (ref: Purchase, nullable)
- batch_number: String (nullable, max 50)
- serial_number: String (nullable, max 50)
- item_id: UUID (ref: Item, required)
- variant_id: UUID (ref: ItemVariant, nullable)
- quantity: Decimal (min: 0.01, precision: 10, scale: 3)
- unit_cost_snapshot: Decimal (required, precision: 10, scale: 2)
- allocation_status: Enum['RESERVED', 'CONSUMED', 'RELEASED', 'CORRECTED'] (required)
- allocated_at: DateTime (auto)
- consumed_at: DateTime (nullable)
- released_at: DateTime (nullable)
- corrected_at: DateTime (nullable)
- correction_reason: String (nullable, max 255)
```

### repair_audit_log (explicit definition)
```markdown
- audit_log_id: UUID
- entity_type: String (required, max 50)
- entity_id: UUID (required)
- action: String (required, max 100)
- before_state: Object (required)
- after_state: Object (required)
- actor_id: UUID (ref: User, nullable)
- actor_type: Enum['USER', 'SYSTEM', 'INTEGRATION'] (required)
- timestamp: DateTime (auto)
- ip_address: String (nullable, max 45)
- user_agent: String (nullable, max 500)
- metadata: Object (nullable)
```

## STATE MACHINES WITH RESOLVED ENUMS

### repair_job State Machine
**States:** QUOTATION → APPROVED → IN_PROGRESS → COMPLETED → DELIVERED → CANCELLED

**Allowed Transitions:**
```markdown
QUOTATION → APPROVED: Customer approval, triggers inventory reservation
QUOTATION → CANCELLED: Customer rejection, no inventory impact
APPROVED → IN_PROGRESS: Technician assignment, triggers inventory consumption
APPROVED → CANCELLED: Customer cancellation, triggers inventory release
IN_PROGRESS → COMPLETED: All services completed successfully
IN_PROGRESS → CANCELLED: Customer request during repair (partial consumption)
COMPLETED → DELIVERED: Customer pickup/acceptance
```

**Timeout Rules:**
```markdown
APPROVED timeout: 72 hours → Auto-cancel + release reservations
IN_PROGRESS timeout: 168 hours (7 days) → Escalate to supervisor
COMPLETED timeout: 720 hours (30 days) → Auto-deliver + notify customer
Reservation expiry: 24 hours if job not started → Release parts
```

**Forbidden Transitions:**
```markdown
Any bypass of APPROVED state
Direct QUOTATION → COMPLETED
DELIVERED → any other state
CANCELLED → any other state
COMPLETED → IN_PROGRESS
```

### repair_part_allocation State Machine
**States:** RESERVED → CONSUMED → RELEASED → CORRECTED

**Allowed Transitions:**
```markdown
RESERVED → CONSUMED: Technician uses part (irreversible)
RESERVED → RELEASED: Job cancellation or part substitution
RESERVED → CORRECTED: Wrong part allocation (requires correction workflow)
```

**Forbidden Transitions:**
```markdown
CONSUMED → any other state (consumption is irreversible)
Direct RESERVED → CORRECTED without correction workflow
```

## INTAKE GOVERNANCE & LEGAL HOLD RULES

### Ownership Verification Rules
```markdown
ownership_verified = false:
- BLOCKS: Job approval (cannot transition to APPROVED)
- REQUIRES: Manager override with verification documentation
- ALLOWS: Device intake and quotation creation
- PREVENTS: Inventory allocation and part consumption

ownership_verified = true:
- ALLOWS: Full repair workflow
- REQUIRES: Verification method and timestamp
- ENABLES: Inventory allocation upon approval
```

### Risk Flag Rules
```markdown
risk_flag = true:
- BLOCKS: Automatic job approval
- REQUIRES: Supervisor review and risk assessment
- ALLOWS: Quotation creation with risk disclosure
- TRIGGERS: Enhanced audit trail requirements
- PREVENTS: High-value part allocation without override

risk_flag = false:
- ALLOWS: Normal workflow
- ENABLES: Automatic approval if within limits
```

### Legal Hold Rules
```markdown
legal_hold = true:
- BLOCKS: All state transitions
- BLOCKS: Inventory allocation
- BLOCKS: Part consumption
- BLOCKS: Device delivery
- REQUIRES: Legal department release
- ALLOWS: Audit-only access

legal_hold = false:
- ALLOWS: Normal workflow
- ENABLES: All state transitions

Legal Hold Release Procedure:
1. Legal officer creates release request with case ID
2. System verifies officer authorization level
3. Release reason + supporting docs required
4. legal_hold set to false with release_timestamp
5. Job resumes from frozen state
6. Permanent audit record: hold duration + release authority
```

### IMEI/Serial Blacklist Handling
```markdown
If device identifiers flagged after intake:
- IMMEDIATE: Set legal_hold = true
- IMMEDIATE: Set risk_flag = true
- BLOCK: All repair progression
- REQUIRE: Legal review before any action
- PREVENT: Inventory allocation for flagged devices

Mid-Repair Blacklist Re-Check:
- Daily automated IMEI verification against blacklist API
- On detection: Freeze job at current state
- Notify authorities if configured
- Prevent delivery until legal hold released
- Consumed parts become liability (non-reversible)
```

## WARRANTY REWORK COST OWNERSHIP RULES

### Cost Ownership Definition
```markdown
Warranty rework costs ARE linked to original repair job:
- Original job_id stored in warranty claim record
- Costs attributed to original job's profitability analysis
- Original technician's quality metrics affected
- Original service category's rework statistics updated
```

### Inventory Consumption Impact
```markdown
Warranty rework inventory consumption:
- Parts consumed from current inventory (FIFO)
- Costs recorded against warranty reserve account
- Original job's part costs remain unchanged
- New allocation records created for rework
```

### Technician Commission Impact
```markdown
Warranty rework technician commission:
- Original technician: 50% commission reduction on rework
- Rework technician: Standard commission on rework
- Quality multiplier: 0.8 for rework jobs
- Rework penalty: +10% to original technician's penalty pool
```

### Revenue Recognition Rules
```markdown
Warranty rework financial treatment:
- NO new revenue recognized (cost-only event)
- Warranty reserve account debited for part costs
- Labor costs recorded as warranty expense
- Original revenue remains unchanged
- Customer invoice shows $0 charge with warranty reference
```

### Warranty Extension Rules
```markdown
Warranty extension on rework:
- Original warranty extended by 90 days from rework completion
- Extension applies to reworked components only
- New warranty record created with original job reference
- Warranty coverage remains at original terms

Max Rework Limit:
- Maximum 3 warranty reworks per original job
- 4th claim requires full re-quotation (not warranty)
- Exceeding limit triggers quality investigation
- Original technician suspended after 3rd rework
```

## INVENTORY INTERACTION RULES

### FIFO ALLOCATION FOR NON-SERIALIZED STOCK
```markdown
Algorithm:
1. Query NonSerializedStock by item_id and variant_id
2. Filter: availableQty > 0 AND status = 'Available'
3. Sort by purchaseDate ASC (oldest first)
4. Allocate from oldest batch until quantity requirement met
5. Update availableQty in source batches
6. Create repair_part_allocation records for each batch

Validation:
- Available quantity ≥ required quantity
- Batch status = 'Available'
- No manual batch selection allowed
- Partial batch allocation permitted

Zero-Cost Batch Handling:
- Exclude batches where unitCost = 0 from FIFO
- Flag zero-cost allocations in audit trail
- Require manager approval for zero-cost consumption
- Zero-cost COGS = $0 (no weighted average)
```

### SERIALIZED STOCK ALLOCATION
```markdown
Algorithm:
1. Find specific SerializedStock record by serialNumber
2. Verify status = 'Available'
3. Create single repair_part_allocation record
4. Update SerializedStock.status to 'Consumed'
5. Use exact unitCost from SerializedStock

Validation:
- Serial number matches physical item
- Item compatibility with service requirements
- No double allocation of same serial number
```

### COST SNAPSHOTTING RULES
```markdown
NonSerializedStock:
- Calculate weighted average from allocated batches
- unit_cost_snapshot = Σ(batch_unit_cost × batch_quantity) / total_quantity
- cost_snapshot = unit_cost_snapshot × quantity

SerializedStock:
- unit_cost_snapshot = SerializedStock.unitCost
- cost_snapshot = unit_cost_snapshot × quantity

Immutability:
- Snapshots become immutable when allocation_status = 'CONSUMED'
- Corrections require new allocation records with correction notes
- Original snapshots preserved for audit trail
```

## AUDIT REQUIREMENTS

### Actions Requiring Audit Logs
```markdown
MANDATORY AUDIT EVENTS:
- All repair_job state transitions
- All repair_part_allocation state transitions
- All repair_job_service status changes
- All cost snapshot creations
- All inventory allocation actions
- All correction workflow executions
- All legal_hold changes
- All risk_flag changes
- All ownership verification changes
- All system setting changes
```

### Immutable Audit Fields
```markdown
Fields that cannot be modified after creation:
- audit_log_id
- entity_type
- entity_id
- action
- before_state
- after_state
- timestamp
- actor_type (if set)
```

### Audit Retention Policy
```markdown
- Financial events: 7 years
- Inventory events: 5 years
- Operational events: 3 years
- Warranty events: Permanent
- Legal hold events: Permanent
```

## INVARIANTS (WHAT MUST NEVER HAPPEN)

### SERVICE DEFINITION INVARIANTS
```markdown
1. No orphaned services: service_model_pricing must reference valid service_template
2. No circular categories: service_category cannot have circular parent references
3. No negative pricing: All price fields must be ≥ 0
4. No invalid discounts: discount_limit cannot exceed service_price
5. No template modification: service_template becomes immutable after first use
```

### INVENTORY INVARIANTS
```markdown
6. No over-allocation: Total allocated quantity cannot exceed available quantity
7. No double allocation: SerializedStock items can only be allocated once
8. No negative stock: availableQty cannot be < 0
9. No cost recalculation: unit_cost_snapshot cannot change after CONSUMED status
10. No batch selection: Manual batch selection for NonSerializedStock is forbidden
```

### JOB EXECUTION INVARIANTS
```markdown
11. No ad-hoc repairs: repair_job must reference valid repair_service_model_pricing
12. No state bypass: repair_job cannot transition to COMPLETED without APPROVED status
13. No price modification: approved_price cannot change after APPROVED status
14. No technician override: Technician assignment requires valid certification
15. No partial consumption rollback: CONSUMED allocations cannot be reversed
16. No invalid tier selection: Job quality tier must exist in service model pricing
```

### FINANCIAL INVARIANTS
```markdown
16. No revenue without approval: Revenue cannot be recognized without customer approval
17. No cost without consumption: Cost cannot be recognized without part consumption
18. No commission without completion: Commission cannot be calculated for incomplete jobs
19. No negative financial impact: All financial calculations must result in non-negative values
20. No retroactive financial changes: Financial snapshots cannot be modified after job completion
```

### AUDIT TRAIL INVARIANTS
```markdown
21. No missing transitions: Every state change must have audit record
22. No anonymous actions: Every action must be attributable to user/system
23. No audit trail deletion: Audit records cannot be deleted
24. No timestamp manipulation: Audit timestamps cannot be modified
25. No incomplete records: Every audit record must have before/after state
```

## ENTERPRISE ARCHITECTURE PATTERNS

### EVENT SOURCING PATTERN
```markdown
Core Principle: Store all state changes as immutable event stream

Event Store Schema:
- event_id: UUID (immutable)
- aggregate_type: String (repair_job, allocation, tier_definition, etc)
- aggregate_id: UUID
- event_type: String (JobApproved, PartConsumed, TierSubstituted, PriceRevised, etc)
- event_data: Object (complete event payload)
- event_version: Integer (optimistic locking)
- created_at: DateTime (immutable)
- correlation_id: UUID (trace related events)
- causation_id: UUID (parent event reference)

Benefits:
- Complete audit trail by design
- Time-travel debugging capability
- Event replay for state reconstruction
- Horizontal scalability via sharding

Implementation:
- Write events first, update state second
- No delete operations (soft delete via events)
- Snapshots every 100 events for performance
```

### CQRS (Command Query Responsibility Segregation)
```markdown
Write Model (Commands):
- Create/Update operations on normalized schema
- Strong consistency requirements
- Transaction boundaries enforced
- Event emission on success

Read Model (Queries):
- Denormalized projections for fast reads
- Eventually consistent (acceptable lag: <5s)
- No business logic in queries
- Optimized indexes for common queries

Projections:
- repair_job_summary: Denormalized job with all services
- repair_inventory_availability: Real-time stock view
- repair_technician_workload: Current assignments
- repair_financial_dashboard: Revenue/COGS aggregates

Sync Mechanism:
- Event handlers update projections
- Idempotent projection updates
- Replay on projection corruption
```

### SAGA PATTERN (Distributed Transactions)
```markdown
Saga: RepairJobApprovalSaga
Steps:
1. Validate Quality Tier availability and pricing
2. Reserve inventory filtered by tier (compensate: ReleaseInventory)
3. Create financial commitment with tier-based pricing (compensate: ReverseCommitment)
4. Assign technician based on tier skill requirements (compensate: UnassignTechnician)
5. Update job status to APPROVED (compensate: RevertStatus)

Saga Coordinator Schema:
- saga_id: UUID
- saga_type: String
- current_step: Integer
- status: Enum['IN_PROGRESS', 'COMPLETED', 'COMPENSATING', 'FAILED']
- compensation_stack: [Object]
- started_at: DateTime
- completed_at: DateTime

Error Handling:
- Step failure triggers compensation in reverse order
- Each compensation must be idempotent
- Saga timeout: 30 seconds → auto-compensate
- Dead letter queue for failed compensations
```

### IDEMPOTENCY GUARANTEES
```markdown
Idempotency Key Schema:
- idempotency_key: String (client-provided, indexed)
- operation_type: String
- request_hash: String (MD5 of request body)
- response_cache: Object
- created_at: DateTime
- expires_at: DateTime (TTL: 24 hours)

Enforcement:
- All mutation APIs require idempotency key
- Duplicate key within TTL returns cached response
- Key format: {client_id}:{timestamp}:{random}
- 409 Conflict if key exists with different request hash
```

### CONCURRENCY CONTROL (Optimistic Locking)
```markdown
Version Field:
- Add _version: Integer to all mutable entities
- Increment on every update
- Update condition: WHERE _version = expected_version

Conflict Resolution:
- 409 Conflict response with latest state
- Client retry with exponential backoff
- Max 3 retry attempts
- Manual intervention after retry exhaustion

Critical Sections (Pessimistic Lock):
- Inventory allocation: Row-level lock on batch
- FIFO selection: Serializable isolation level
- Payment processing: Distributed lock (Redis)
```

## MULTI-CURRENCY & TAX SUPPORT

### Multi-Currency Schema
```markdown
currency_exchange_rate:
- rate_id: UUID
- base_currency: String (default: USD)
- target_currency: String
- exchange_rate: Decimal (precision: 10, scale: 6)
- effective_from: DateTime
- effective_to: DateTime (nullable)
- rate_source: String (API/Manual)

repair_job Extensions:
- currency_code: String (ISO 4217, default from settings)
- exchange_rate_snapshot: Decimal (locked at approval)
- base_currency_amount: Decimal (for reporting)

Conversion Rules:
- Lock exchange rate at job approval
- Store amounts in job currency + base currency
- Financial reports default to base currency
- Customer invoice in job currency
```

### Tax Calculation
```markdown
tax_rate_configuration:
- tax_rate_id: UUID
- jurisdiction: String
- service_category_id: UUID (nullable, null = all)
- tax_type: Enum['VAT', 'GST', 'SALES_TAX']
- rate_percentage: Decimal (precision: 5, scale: 2)
- effective_from: DateTime
- effective_to: DateTime (nullable)

repair_job_tax_line:
- tax_line_id: UUID
- repair_job_id: UUID
- tax_type: String
- taxable_amount: Decimal
- tax_rate: Decimal (snapshot)
- tax_amount: Decimal
- jurisdiction: String

Tax Calculation Logic:
- Calculate at quotation (estimate)
- Lock at approval (immutable)
- Support compound taxes (tax on tax)
- Partial cancellation: Proportional tax reversal
```

## PARTIAL PAYMENT & DEPOSIT HANDLING

### Payment Plan Schema
```markdown
repair_payment_plan:
- payment_plan_id: UUID
- repair_job_id: UUID
- total_amount: Decimal
- deposit_amount: Decimal (min: 20% of total)
- deposit_status: Enum['PENDING', 'PAID', 'REFUNDED']
- installment_count: Integer
- installment_amount: Decimal
- payment_schedule: [Object] (due dates)

repair_payment_transaction:
- transaction_id: UUID
- payment_plan_id: UUID
- installment_number: Integer
- amount: Decimal
- payment_method: String
- payment_status: Enum['PENDING', 'COMPLETED', 'FAILED']
- paid_at: DateTime
- idempotency_key: String (unique)

Business Rules:
- Minimum deposit: 20% of total_approved_amount
- Delivery blocked until full payment
- Deposit refund on pre-consumption cancellation
- Deposit forfeit on post-consumption cancellation
```

### Device Accessories Tracking
```markdown
repair_device_accessory:
- accessory_id: UUID
- customer_device_id: UUID
- accessory_type: Enum['CHARGER', 'CASE', 'EARPHONES', 'SIM_CARD', 'MEMORY_CARD', 'OTHER']
- description: String
- condition: String
- image_url: String (nullable)
- returned: Boolean (default: false)
- returned_at: DateTime (nullable)

Intake Checklist:
- Mandatory accessory documentation at intake
- Photo evidence for valuable accessories
- Customer signature on accessory list
- Return verification at delivery
- Missing accessory liability protocol
```

## SCALABILITY & PERFORMANCE

### Database Optimization
```markdown
Indexes (Compound):
- repair_job: (current_status, created_at DESC)
- repair_job: (customer_device_id, current_status)
- repair_part_allocation: (allocation_status, item_id, created_at)
- repair_audit_log: (entity_type, entity_id, timestamp DESC)
- repair_payment_transaction: (idempotency_key) UNIQUE

Partitioning Strategy:
- repair_audit_log: Monthly range partitioning
- repair_job: Status-based list partitioning
- Event store: Daily range partitioning

Query Optimization Rules:
- No SELECT * in production code
- Explicit field projection
- Cursor-based pagination (no OFFSET)
- Read replicas for reporting
- Materialized views for dashboards
```

### Caching Strategy
```markdown
Cache Layers:
1. Application (Redis):
   - Service template definitions (TTL: 1 hour)
   - Pricing calculations (TTL: 30 min)
   - Technician availability (TTL: 5 min)
   - Exchange rates (TTL: 15 min)

2. Database Query Cache:
   - Frequently accessed read models
   - Invalidate on write events

Cache Invalidation:
- Event-driven invalidation
- Tag-based cache groups
- Atomic invalidation with updates
- Cache warming on deployment
```

### Horizontal Scalability
```markdown
Stateless Services:
- No in-memory session state
- JWT for authentication
- Redis for distributed sessions
- Message queue for async tasks

Load Distribution:
- API Gateway with rate limiting
- Service mesh for inter-service communication
- Database connection pooling (min: 10, max: 50)
- Read/write splitting

Async Processing:
- Job approval notifications
- Warranty expiry checks
- Reminder emails
- Report generation
- Batch inventory updates
```

## DISASTER RECOVERY & BACKUP

### Backup Strategy
```markdown
Schedule:
- Full backup: Daily at 2 AM UTC
- Incremental backup: Every 6 hours
- Transaction log backup: Every 15 minutes
- Retention: 30 days online, 1 year archive

Backup Scope:
- All MongoDB collections
- Event store (immutable)
- File storage (device images, documents)
- Configuration snapshots

Restore Procedures:
- Point-in-time recovery capability
- RTO (Recovery Time Objective): 4 hours
- RPO (Recovery Point Objective): 15 minutes
- Quarterly restore drills
```

### High Availability
```markdown
Database:
- MongoDB replica set (3 nodes minimum)
- Automatic failover (<30 seconds)
- Read preference: primaryPreferred
- Write concern: majority

Application:
- Multi-region deployment
- Auto-scaling (min: 2, max: 10 instances)
- Health check endpoints
- Circuit breaker pattern

Monitoring:
- Uptime SLA: 99.9%
- Response time P95: <200ms
- Error rate threshold: <0.1%
- Alert escalation: PagerDuty/Slack
```

## CODE QUALITY STANDARDS

### Mandatory Practices
```markdown
1. Test Coverage:
   - Unit tests: >80% coverage
   - Integration tests: All critical paths
   - E2E tests: Complete user journeys
   - Load tests: 1000 concurrent users

2. Code Review:
   - Minimum 2 approvals for production code
   - Automated linting (ESLint/Prettier)
   - Security scanning (Snyk/SonarQube)
   - Performance profiling on CI/CD

3. Documentation:
   - OpenAPI/Swagger for all APIs
   - Inline JSDoc comments
   - Architecture decision records (ADR)
   - Runbook for operations

4. Error Handling:
   - Structured error codes
   - Client-safe error messages
   - Detailed server-side logging
   - Sentry/Rollbar integration

5. Logging:
   - Structured JSON logs
   - Correlation IDs in all requests
   - Log levels: ERROR, WARN, INFO, DEBUG
   - PII redaction in logs
```

### API Design Standards
```markdown
REST Conventions:
- Versioned APIs: /api/v1/repair-jobs
- Noun-based resources (not verbs)
- HTTP methods: GET, POST, PUT, PATCH, DELETE
- Status codes: 200, 201, 204, 400, 401, 403, 404, 409, 500

Response Format:
{
  "success": boolean,
  "data": object | array,
  "meta": { "page", "total", "timestamp" },
  "errors": [{ "code", "message", "field" }]
}

Rate Limiting:
- 100 requests/minute per user
- 1000 requests/minute per tenant
- 429 Too Many Requests with Retry-After header
```

This comprehensive architecture ensures production-grade, scalable, and maintainable repair module implementation following industry best practices.
