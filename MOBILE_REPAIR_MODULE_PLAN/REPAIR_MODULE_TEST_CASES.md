# REPAIR MODULE TEST CASES & VALIDATION SCENARIOS
## COMPREHENSIVE TESTING SPECIFICATION

## TEST CATEGORY: NORMAL FLOWS

### NF-001: Complete Repair Job Lifecycle
**Description:** Standard repair from quotation to delivery
**Preconditions:** Valid customer device with ownership_verified = true
**Test Steps:**
1. Create repair_job with status = 'QUOTATION'
2. Add repair_job_service with pricing snapshot
3. Customer approval → status = 'APPROVED'
4. System allocates parts via FIFO (verify batch selection)
5. Technician assignment → status = 'IN_PROGRESS'
6. Consume parts (verify cost snapshots)
7. Complete all services → status = 'COMPLETED'
8. Customer delivery → status = 'DELIVERED'

**Expected Results:**
- All state transitions successful
- Parts allocated from oldest batches (FIFO)
- Cost snapshots match expected weighted average
- Audit trail contains all state changes
- Financial records immutable after completion

**Validation:**
```javascript
// Verify FIFO allocation
const allocations = await repair_part_allocation.find({ job_part_id: jobPartId });
const batches = await NonSerializedStock.find({
  _id: { $in: allocations.map(a => a.non_serialized_stock_id) }
}).sort({ purchaseDate: 1 });

// Verify oldest batches selected
assert.deepEqual(
  allocations.map(a => a.non_serialized_stock_id),
  batches.map(b => b._id)
);

// Verify cost snapshots
const expectedCost = calculateWeightedAverage(batches, allocations);
assert.equal(jobPart.unit_cost_snapshot, expectedCost);
```

### NF-002: Service Template Creation with Brand Config
**Description:** Create new service template with full configuration
**Test Steps:**
1. Create repair_service_category
2. Create repair_service_template referencing category
3. Create repair_service_brand_config for template
4. Create repair_service_model_pricing for specific device
5. Add repair_service_required_part with validation rules

**Expected Results:**
- Template becomes immutable after first pricing reference
- Brand config inherits template settings correctly
- Model pricing calculates correct total price
- Part validation rules enforce compatibility

**Validation:**
```javascript
// Test template immutability
const template = await repair_service_template.findById(templateId);
template.template_name = "Modified Name";
await assert.rejects(
  template.save(),
  "Template modification should be prevented after use"
);

// Verify pricing calculation
const pricing = await repair_service_model_pricing.findById(pricingId);
const expectedPrice = brandConfig.base_labor_rate +
                     brandConfig.labor_multiplier +
                     estimatedPartsCost;
assert.equal(pricing.service_price, expectedPrice);
```

### NF-003: FIFO Part Allocation with Multiple Batches
**Description:** Automatic batch selection for non-serialized parts
**Test Steps:**
1. Create 3 purchase batches with different dates and costs
   - Batch A: 10 units, $5.00, Jan 1
   - Batch B: 15 units, $5.50, Jan 15
   - Batch C: 20 units, $6.00, Feb 1
2. Create repair job requiring 25 units
3. Approve job (triggers allocation)
4. Verify batch selection order and quantities

**Expected Results:**
- 10 units from Batch A (oldest)
- 15 units from Batch B
- 0 units from Batch C
- Correct availableQty updates
- Weighted average cost calculated correctly

**Validation:**
```javascript
// Verify allocation quantities
const batchAAllocation = allocations.find(a => a.batch_number === "A");
const batchBAllocation = allocations.find(a => a.batch_number === "B");
const batchCAllocation = allocations.find(a => a.batch_number === "C");

assert.equal(batchAAllocation.quantity, 10);
assert.equal(batchBAllocation.quantity, 15);
assert.isUndefined(batchCAllocation);

// Verify weighted average
const expectedAvg = ((10 * 5.00) + (15 * 5.50)) / 25; // = $5.30
assert.equal(jobPart.unit_cost_snapshot, expectedAvg);
```

## TEST CATEGORY: EDGE CASES

### EC-001: Quotation Rejection After Reservation
**Description:** Customer rejects approved quotation
**Preconditions:** Job in 'APPROVED' state with reserved parts
**Test Steps:**
1. Create and approve repair job
2. Verify parts reserved (status = 'RESERVED')
3. Customer rejects quotation
4. System processes cancellation

**Expected Results:**
- Parts returned to available inventory
- Job status = 'CANCELLED'
- Allocation status = 'RELEASED'
- No financial impact recorded
- Audit trail records cancellation

**Validation:**
```javascript
// Verify inventory restoration
const batch = await NonSerializedStock.findById(batchId);
assert.equal(batch.availableQty, originalAvailableQty);

// Verify allocation status
const allocation = await repair_part_allocation.findById(allocationId);
assert.equal(allocation.allocation_status, 'RELEASED');

// Verify no COGS posted
const cogsRecords = await getCOGSRecords(jobId);
assert.lengthOf(cogsRecords, 0);
```

### EC-002: Wrong Part Consumption with Correction
**Description:** Technician consumes incorrect part, then corrects
**Preconditions:** Job in 'IN_PROGRESS' with correct part allocated
**Test Steps:**
1. Allocate correct part (Part A)
2. Technician incorrectly consumes wrong part (Part B)
3. System detects mismatch via validation
4. Initiate correction workflow
5. Release wrong allocation
6. Allocate and consume correct part

**Expected Results:**
- Wrong allocation marked 'CORRECTED'
- Correct part allocated via FIFO
- Cost snapshots updated correctly
- Audit trail records correction with reason

**Validation:**
```javascript
// Verify correction records
const wrongAllocation = await repair_part_allocation.findById(wrongAllocationId);
assert.equal(wrongAllocation.allocation_status, 'CORRECTED');
assert.equal(wrongAllocation.correction_reason, 'WRONG_PART_CONSUMPTION');

// Verify new allocation
const correctAllocation = await repair_part_allocation.findOne({
  job_part_id: jobPartId,
  item_id: correctPartId
});
assert.equal(correctAllocation.allocation_status, 'CONSUMED');

// Verify audit trail
const auditRecords = await repair_audit_log.find({
  entity_type: 'repair_part_allocation',
  entity_id: wrongAllocationId
});
assert.lengthOf(auditRecords, 2); // Original and correction
```

### EC-003: Partial Repair Completion
**Description:** Customer accepts partial repair completion
**Preconditions:** Job with 3 services, 1 fails during execution
**Test Steps:**
1. Complete 2 services successfully
2. 1 service fails (diagnosis error)
3. Customer accepts partial completion
4. System processes partial delivery

**Expected Results:**
- 2 services status = 'COMPLETED'
- 1 service status = 'FAILED'
- Partial charges calculated correctly
- Unused parts released back to inventory
- Job status = 'DELIVERED' with partial flag

**Validation:**
```javascript
// Verify service statuses
const completedServices = await repair_job_service.count({
  repair_job_id: jobId,
  status: 'COMPLETED'
});
const failedServices = await repair_job_service.count({
  repair_job_id: jobId,
  status: 'FAILED'
});
assert.equal(completedServices, 2);
assert.equal(failedServices, 1);

// Verify partial revenue
const job = await repair_job.findById(jobId);
const expectedRevenue = completedServices.reduce((sum, s) => sum + s.approved_price, 0);
assert.equal(job.total_final_amount, expectedRevenue);
```

### EC-004: Device with Legal Hold Attempt
**Description:** Attempt repair on device with legal_hold = true
**Preconditions:** Customer device with legal_hold = true
**Test Steps:**
1. Attempt to create repair job
2. System checks legal_hold status
3. Attempt state transition to 'APPROVED'
4. Attempt part allocation

**Expected Results:**
- Job creation allowed (for tracking)
- All state transitions BLOCKED
- Inventory allocation BLOCKED
- Audit trail records blocked attempts
- Error messages specify legal hold reason

**Validation:**
```javascript
// Verify blocked transitions
const job = await createRepairJob({ customer_device_id: legalHoldDeviceId });
assert.equal(job.current_status, 'QUOTATION');

await assert.rejects(
  job.transitionTo('APPROVED'),
  "State transition should be blocked for legal hold devices"
);

// Verify blocked allocation
await assert.rejects(
  allocateParts(jobId),
  "Part allocation should be blocked for legal hold devices"
);

// Verify audit records
const blockedAttempts = await repair_audit_log.find({
  entity_type: 'repair_job',
  entity_id: jobId,
  action: 'BLOCKED_LEGAL_HOLD'
});
assert.lengthOf(blockedAttempts, 2); // Transition and allocation attempts
```

### EC-005: Warranty Rework with Original Job Linking
**Description:** Warranty rework linked to original repair
**Preconditions:** Completed original job with active warranty
**Test Steps:**
1. Customer returns device within warranty period
2. Create warranty claim with original job reference
3. System validates warranty coverage
4. Create new repair job with warranty flag
5. Process rework with new parts
6. Complete rework job

**Expected Results:**
- New job linked to original via warranty_claim_id
- Warranty costs attributed to original job
- Original technician quality metrics affected
- Extended warranty period (90 days)
- No customer charge for rework

**Validation:**
```javascript
// Verify warranty linking
const reworkJob = await repair_job.findById(reworkJobId);
assert.equal(reworkJob.warranty_claim_id, originalWarrantyClaimId);
assert.equal(reworkJob.is_warranty_rework, true);

// Verify original job impact
const originalJob = await repair_job.findById(originalJobId);
assert.include(originalJob.warranty_reworks, reworkJobId);

// Verify financial impact
const warrantyCosts = await getWarrantyCosts(originalJobId);
assert.equal(warrantyCosts.length, 1);
assert.equal(warrantyCosts[0].rework_job_id, reworkJobId);

// Verify no revenue
const revenueRecords = await getRevenueRecords(reworkJobId);
assert.lengthOf(revenueRecords, 0);
```

## TEST CATEGORY: ROLLBACK SCENARIOS

### RB-001: Job Cancellation Before Consumption
**Description:** Cancel job after approval but before part consumption
**Preconditions:** Job in 'APPROVED' state with reserved parts
**Test Steps:**
1. Verify job status = 'APPROVED'
2. Verify parts status = 'RESERVED'
3. Initiate cancellation
4. Verify rollback completion

**Expected Results:**
- All reservations released (status = 'RELEASED')
- Available quantities restored to original values
- Job status = 'CANCELLED'
- No COGS posted
- Audit trail records complete rollback

**Validation:**
```javascript
// Verify inventory restoration
const batches = await NonSerializedStock.find({
  _id: { $in: reservedBatchIds }
});
batches.forEach(batch => {
  const original = originalBatches.find(b => b._id.equals(batch._id));
  assert.equal(batch.availableQty, original.availableQty);
});

// Verify allocation statuses
const allocations = await repair_part_allocation.find({
  repair_job_id: jobId
});
allocations.forEach(allocation => {
  assert.equal(allocation.allocation_status, 'RELEASED');
});

// Verify no financial impact
assert.lengthOf(await getCOGSRecords(jobId), 0);
assert.lengthOf(await getRevenueRecords(jobId), 0);
```

### RB-002: Partial Consumption Rollback
**Description:** Cancel job after partial part consumption
**Preconditions:** Job in 'IN_PROGRESS' with some parts consumed
**Test Steps:**
1. Consume 2 out of 4 allocated parts
2. Initiate cancellation
3. Verify partial rollback

**Expected Results:**
- Unconsumed parts released (2 parts)
- Consumed parts remain allocated (2 parts)
- Partial COGS recorded for consumed parts
- Job status = 'CANCELLED'
- Customer liability created for consumed parts

**Validation:**
```javascript
// Verify partial release
const releasedAllocations = await repair_part_allocation.find({
  repair_job_id: jobId,
  allocation_status: 'RELEASED'
});
const consumedAllocations = await repair_part_allocation.find({
  repair_job_id: jobId,
  allocation_status: 'CONSUMED'
});
assert.lengthOf(releasedAllocations, 2);
assert.lengthOf(consumedAllocations, 2);

// Verify partial COGS
const cogsRecords = await getCOGSRecords(jobId);
assert.lengthOf(cogsRecords, 1);
assert.equal(cogsRecords[0].amount, consumedAllocations.reduce(
  (sum, a) => sum + a.total_cost_snapshot, 0
));

// Verify customer liability
const liability = await getCustomerLiability(jobId);
assert.equal(liability.amount, cogsRecords[0].amount);
```

### RB-003: Failed State Transition Rollback
**Description:** Invalid state transition attempt with automatic rollback
**Preconditions:** Job in 'QUOTATION' state
**Test Steps:**
1. Attempt direct transition to 'COMPLETED'
2. System detects invalid transition
3. Initiates automatic rollback to safe state

**Expected Results:**
- Transition rejected with validation error
- Job remains in 'QUOTATION' state
- No inventory impact
- Audit trail records attempt and rollback

**Validation:**
```javascript
// Verify state unchanged
const job = await repair_job.findById(jobId);
assert.equal(job.current_status, 'QUOTATION');

// Verify no inventory changes
const allocations = await repair_part_allocation.find({
  repair_job_id: jobId
});
assert.lengthOf(allocations, 0);

// Verify audit records
const auditRecords = await repair_audit_log.find({
  entity_type: 'repair_job',
  entity_id: jobId,
  action: { $in: ['INVALID_TRANSITION_ATTEMPT', 'AUTOMATIC_ROLLBACK'] }
});
assert.lengthOf(auditRecords, 2);
```

## TEST CATEGORY: CONCURRENCY CONFLICTS

### CC-001: Simultaneous Part Allocation
**Description:** Multiple jobs allocating same limited stock
**Preconditions:** 5 units available, 2 jobs request 3 units each
**Test Steps:**
1. Job A and Job B approved simultaneously
2. Both request allocation from same batch
3. System processes allocations with transaction isolation

**Expected Results:**
- First job gets full allocation (3 units)
- Second job gets partial allocation (2 units)
- Inventory consistency maintained
- Audit trail records conflict resolution

**Validation:**
```javascript
// Verify allocation results
const jobAAllocations = await repair_part_allocation.find({
  repair_job_id: jobAId
});
const jobBAllocations = await repair_part_allocation.find({
  repair_job_id: jobBId
});

assert.equal(getTotalAllocated(jobAAllocations), 3);
assert.equal(getTotalAllocated(jobBAllocations), 2);

// Verify inventory consistency
const batch = await NonSerializedStock.findById(batchId);
const totalAllocated = jobAAllocations.reduce((sum, a) => sum + a.quantity, 0) +
                      jobBAllocations.reduce((sum, a) => sum + a.quantity, 0);
assert.equal(batch.availableQty, originalAvailableQty - totalAllocated);

// Verify conflict audit records
const conflictRecords = await repair_audit_log.find({
  entity_type: 'repair_part_allocation',
  action: 'CONCURRENCY_CONFLICT_RESOLVED'
});
assert.lengthOf(conflictRecords, 1); // One conflict event
```

### CC-002: Concurrent Job Status Update
**Description:** Multiple users updating job status simultaneously
**Preconditions:** Job in 'APPROVED' state
**Test Steps:**
1. Technician A attempts transition to 'IN_PROGRESS'
2. Technician B attempts transition to 'IN_PROGRESS'
3. System resolves conflict

**Expected Results:**
- First update succeeds (Technician A)
- Second update rejected with conflict error
- Job status remains 'IN_PROGRESS'
- Audit trail records both attempts

**Validation:**
```javascript
// Verify final state
const job = await repair_job.findById(jobId);
assert.equal(job.current_status, 'IN_PROGRESS');
assert.equal(job.technician_id, technicianAId);

// Verify rejected attempt
const rejectedAttempt = await repair_audit_log.findOne({
  entity_type: 'repair_job',
  entity_id: jobId,
  action: 'STATUS_UPDATE_REJECTED',
  actor_id: technicianBId
});
assert.exists(rejectedAttempt);

// Verify successful attempt
const successfulAttempt = await repair_audit_log.findOne({
  entity_type: 'repair_job',
  entity_id: jobId,
  action: 'STATUS_UPDATED',
  actor_id: technicianAId,
  after_state: { current_status: 'IN_PROGRESS' }
});
assert.exists(successfulAttempt);
```

### CC-003: Simultaneous Settings Update
**Description:** Multiple admins updating same system setting
**Preconditions:** System setting with current value
**Test Steps:**
1. Admin A updates setting to value X
2. Admin B updates setting to value Y
3. System resolves conflict with versioning

**Expected Results:**
- Last update wins with version check
- Previous update recorded in audit trail
- Setting consistency maintained
- Both admins notified of conflict

**Validation:**
```javascript
// Verify final setting value
const setting = await repair_system_settings.findById(settingId);
assert.equal(setting.setting_value, 'Y'); // Last update
assert.equal(setting.version, 3); // Original (1) + 2 updates

// Verify audit trail
const settingUpdates = await repair_audit_log.find({
  entity_type: 'repair_system_settings',
  entity_id: settingId,
  action: 'SETTING_UPDATED'
}).sort({ timestamp: 1 });

assert.lengthOf(settingUpdates, 2);
assert.equal(settingUpdates[0].after_state.setting_value, 'X');
assert.equal(settingUpdates[1].after_state.setting_value, 'Y');
assert.equal(settingUpdates[1].before_state.setting_value, 'X');

// Verify notifications
const notifications = await getAdminNotifications();
assert.lengthOf(notifications.filter(n =>
  n.type === 'SETTING_CONFLICT' &&
  n.related_setting === settingId
), 2); // Both admins notified
```

### CC-004: Concurrent Device Intake with Duplicate IMEI
**Description:** Multiple intake attempts with same IMEI
**Preconditions:** Unique IMEI constraint on repair_customer_device
**Test Steps:**
1. Intake attempt A with IMEI 12345
2. Intake attempt B with IMEI 12345
3. System resolves conflict

**Expected Results:**
- First intake succeeds
- Second intake rejected with duplicate error
- Audit trail records both attempts
- Customer notification for duplicate

**Validation:**
```javascript
// Verify first intake succeeded
const deviceA = await repair_customer_device.findOne({
  imei_or_serial: '12345'
});
assert.exists(deviceA);
assert.equal(deviceA._id, intakeAResult._id);

// Verify second intake rejected
await assert.rejects(
  repair_customer_device.create(intakeBData),
  "Duplicate IMEI should be rejected"
);

// Verify audit records
const intakeAttempts = await repair_audit_log.find({
  entity_type: 'repair_customer_device',
  action: { $in: ['DEVICE_INTAKE_SUCCESS', 'DEVICE_INTAKE_REJECTED'] },
  metadata: { imei_or_serial: '12345' }
});
assert.lengthOf(intakeAttempts, 2);
assert.equal(intakeAttempts[0].action, 'DEVICE_INTAKE_SUCCESS');
assert.equal(intakeAttempts[1].action, 'DEVICE_INTAKE_REJECTED');
```

## TEST CATEGORY: FINANCIAL IMMUTABILITY

### FI-001: COGS Immutability After Posting
**Description:** Attempt to modify COGS after job completion
**Preconditions:** Completed job with posted COGS
**Test Steps:**
1. Verify COGS posted for completed job
2. Attempt to modify repair_job_part cost snapshots
3. Attempt to modify repair_part_allocation costs
4. Verify immutability enforcement

**Expected Results:**
- COGS modification attempts rejected
- Original COGS records unchanged
- Audit trail records modification attempts
- Error messages indicate immutability violation

**Validation:**
```javascript
// Verify COGS posting
const cogsRecords = await getCOGSRecords(completedJobId);
assert.lengthOf(cogsRecords, 1);
const originalCOGS = cogsRecords[0].amount;

// Attempt modifications
const jobPart = await repair_job_part.findById(consumedPartId);
const originalSnapshot = jobPart.unit_cost_snapshot;

jobPart.unit_cost_snapshot = originalSnapshot * 2;
await assert.rejects(
  jobPart.save(),
  "COGS modification should be prevented"
);

// Verify unchanged
const updatedJobPart = await repair_job_part.findById(consumedPartId);
assert.equal(updatedJobPart.unit_cost_snapshot, originalSnapshot);

// Verify audit records
const modificationAttempts = await repair_audit_log.find({
  entity_type: 'repair_job_part',
  entity_id: consumedPartId,
  action: 'IMMUTABILITY_VIOLATION_ATTEMPT'
});
assert.lengthOf(modificationAttempts, 1);
```

### FI-002: Revenue Immutability After Recognition
**Description:** Attempt to modify revenue after delivery
**Preconditions:** Delivered job with recognized revenue
**Test Steps:**
1. Verify revenue recognized for delivered job
2. Attempt to modify repair_job total_final_amount
3. Attempt to modify individual service prices
4. Verify immutability enforcement

**Expected Results:**
- Revenue modification attempts rejected
- Original revenue records unchanged
- Customer invoice remains valid
- Audit trail records attempts

**Validation:**
```javascript
// Verify revenue recognition
const revenueRecords = await getRevenueRecords(deliveredJobId);
assert.lengthOf(revenueRecords, 1);
const originalRevenue = revenueRecords[0].amount;

// Attempt modifications
const job = await repair_job.findById(deliveredJobId);
job.total_final_amount = originalRevenue * 1.5;
await assert.rejects(
  job.save(),
  "Revenue modification should be prevented"
);

// Verify unchanged
const updatedJob = await repair_job.findById(deliveredJobId);
assert.equal(updatedJob.total_final_amount, originalRevenue);

// Verify invoice validity
const invoice = await getCustomerInvoice(deliveredJobId);
assert.equal(invoice.amount, originalRevenue);
assert.equal(invoice.status, 'VALID');
```

## TEST CATEGORY: INTAKE GOVERNANCE

### IG-001: Ownership Verification Block
**Description:** Attempt job approval with ownership_verified = false
**Preconditions:** Device with ownership_verified = false
**Test Steps:**
1. Create repair job for unverified device
2. Attempt transition to 'APPROVED'
3. Verify block and error handling

**Expected Results:**
- Transition rejected with ownership verification error
- Job remains in 'QUOTATION' state
- Audit trail records blocked attempt
- Manager override option presented

**Validation:**
```javascript
// Verify block
const job = await repair_job.findById(jobId);
await assert.rejects(
  job.transitionTo('APPROVED'),
  "Should require ownership verification"
);

// Verify state unchanged
assert.equal(job.current_status, 'QUOTATION');

// Verify audit record
const blockRecord = await repair_audit_log.findOne({
  entity_type: 'repair_job',
  entity_id: jobId,
  action: 'APPROVAL_BLOCKED_OWNERSHIP'
});
assert.exists(blockRecord);

// Verify override option
const overrideOptions = await getAvailableOverrides(jobId);
assert.include(overrideOptions, 'MANAGER_OWNERSHIP_OVERRIDE');
```

### IG-002: Risk Flag Escalation
**Description:** Job creation with risk_flag = true
**Preconditions:** Device with risk_flag = true
**Test Steps:**
1. Create repair job for high-risk device
2. Verify automatic escalation
3. Attempt high-value part allocation
4. Verify risk-based restrictions

**Expected Results:**
- Job created with risk flag inherited
- Automatic supervisor assignment
- High-value part allocation blocked
- Enhanced audit requirements activated

**Validation:**
```javascript
// Verify risk inheritance
const job = await repair_job.findById(riskyJobId);
assert.equal(job.risk_flag, true);
assert.equal(job.risk_reason, 'HIGH_VALUE_DEVICE');

// Verify supervisor assignment
assert.exists(job.supervisor_id);
assert.equal(job.requires_supervisor_approval, true);

// Verify part allocation block
const highValuePart = await getHighValuePart();
await assert.rejects(
  allocatePart(jobId, highValuePart.id),
  "High-value part allocation should be blocked for risky jobs"
);

// Verify enhanced audit
const auditRecords = await repair_audit_log.find({
  entity_type: 'repair_job',
  entity_id: jobId,
  metadata: { risk_related: true }
});
assert.lengthOf(auditRecords, 3); // Creation, supervisor assignment, allocation attempt
```

## TEST EXECUTION MATRIX

| Test Category | Test Count | Automation | Frequency | Criticality |
|---------------|------------|------------|-----------|-------------|
| Normal Flows | 3 | Full | Every build | High |
| Edge Cases | 5 | Full | Every build | High |
| Rollback Scenarios | 3 | Full | Every build | Critical |
| Concurrency Conflicts | 4 | Stress | Nightly | Critical |
| Financial Immutability | 2 | Full | Every build | Critical |
| Intake Governance | 2 | Full | Every build | High |

## TEST ENVIRONMENT REQUIREMENTS

```markdown
Database:
- MongoDB 6.0+
- Separate test database
- Transaction support enabled
- Audit collection with TTL indexes

Inventory:
- Pre-loaded test batches (5+ with different dates/costs)
- Serialized items (10+ with unique serial numbers)
- Various item categories and compatibility rules

Users:
- Multiple technician roles with different certifications
- Supervisor and manager accounts
- Customer accounts with device ownership

System:
- Concurrent request capability (for concurrency testing)
- Time manipulation (for warranty period testing)
- Error injection capability
```

## TEST DATA REQUIREMENTS

```markdown
Service Templates:
- 3 categories with hierarchy
- 5 templates per category
- Mixed service types (LABOR_ONLY, PARTS_ONLY, MIXED)

Brand Configurations:
- 3 brands with different multipliers
- Varying OEM requirements
- Different certification requirements

Model Pricing:
- 5 models per brand
- Varying pricing structures
- Different warranty periods

Customer Devices:
- 10 devices with verified ownership
- 5 devices with unverified ownership
- 2 devices with legal hold
- 3 devices with risk flags
```

## TEST VALIDATION CRITERIA

```markdown
Pass Criteria:
- All normal flow tests pass
- All edge case tests pass
- All rollback scenarios maintain data integrity
- All concurrency tests resolve conflicts correctly
- All immutability tests prevent modifications
- All governance tests enforce rules correctly
- Performance tests meet response time requirements
- Security tests prevent unauthorized access

Fail Criteria:
- Any normal flow test fails
- Any edge case causes data corruption
- Any rollback leaves inconsistent state
- Any concurrency conflict causes data loss
- Any immutability violation succeeds
- Any governance rule bypass succeeds
- Performance tests exceed time limits
- Security tests allow unauthorized access
```

This comprehensive test specification provides complete coverage of all Mobile Repair Module functionality, including normal operations, edge cases, financial integrity, and system governance. All test cases are designed to validate the strict ERP-grade requirements and immutability guarantees specified in the implementation documents.
