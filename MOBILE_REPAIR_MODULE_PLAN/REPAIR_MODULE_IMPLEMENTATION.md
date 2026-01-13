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

### repair_service_template (unchanged)
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
- created_at: DateTime (auto)
- updated_at: DateTime (auto)
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

### repair_job_service (unchanged)
```markdown
- job_service_id: UUID
- repair_job_id: UUID (ref: repair_job, required)
- pricing_id: UUID (ref: repair_service_model_pricing, required)
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
```

### IMEI/Serial Blacklist Handling
```markdown
If device identifiers flagged after intake:
- IMMEDIATE: Set legal_hold = true
- IMMEDIATE: Set risk_flag = true
- BLOCK: All repair progression
- REQUIRE: Legal review before any action
- PREVENT: Inventory allocation for flagged devices
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
