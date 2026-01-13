# Mobile Repair Module Backend Specification

## Overview

This document provides a complete backend specification for the Mobile Repair Module of the ishopMaster ERP system. The specification includes collections, schemas, workflows, and business rules to ensure deterministic, ERP-grade functionality.

## 1. Collections & Schemas

### 1.1 Service Master Collections

#### 1.1.1 ServiceTemplates Collection
**Purpose:** Master services catalog with standardized repair procedures

```javascript
{
  _id: ObjectId,
  serviceCode: { type: String, required: true, unique: true }, // e.g., "DISPLAY_REPLACEMENT"
  name: { type: String, required: true }, // Display name
  description: { type: String, required: true }, // Detailed description
  category: { 
    type: ObjectId, 
    ref: 'ServiceCategories', 
    required: true 
  },
  brandConfigs: [{ 
    type: ObjectId, 
    ref: 'ServiceBrandConfigs' 
  }],
  isActive: { type: Boolean, default: true },
  isTemplate: { type: Boolean, default: true }, // Distinguishes from actual service instances
  internalConfig: {
    serviceType: {
      type: String,
      enum: ["hardware_repair", "software_service", "diagnostic", "cleaning", "replacement"],
      default: "hardware_repair"
    },
    requiresParts: { type: Boolean, default: true },
    requiresTechnician: { type: Boolean, default: true },
    skillLevel: {
      type: String,
      enum: ["beginner", "intermediate", "advanced", "expert"],
      default: "intermediate"
    },
    isHighRisk: { type: Boolean, default: false },
    estimatedTime: { type: Number }, // minutes
    workflow: {
      steps: [{ 
        stepName: String, 
        description: String,
        estimatedTime: Number,
        qualityChecks: [{ type: String }],
        photosRequired: { type: Boolean, default: true }
      }]
    }
  },
  customerFacing: {
    displayName: { type: String },
    description: { type: String },
    includes: [{ type: String }],
    excludes: [{ type: String }],
    warrantyMonths: { type: Number, default: 3 }
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  // IMMUTABLE AFTER CREATION
  createdById: { type: ObjectId, ref: 'User', required: true },
  version: { type: Number, default: 1 } // For tracking changes
}
```

#### 1.1.2 ServiceCategories Collection
**Purpose:** Organize services into logical categories

```javascript
{
  _id: ObjectId,
  name: { type: String, required: true, unique: true }, // e.g., "Screen Repair", "Battery Replacement"
  description: { type: String },
  parentCategory: { type: ObjectId, ref: 'ServiceCategories' }, // For hierarchical categories
  sortOrder: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  // IMMUTABLE AFTER CREATION
  createdById: { type: ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

#### 1.1.3 ServiceBrandConfigs Collection
**Purpose:** Brand-specific service configurations

```javascript
{
  _id: ObjectId,
  serviceTemplate: { type: ObjectId, ref: 'ServiceTemplates', required: true },
  brand: { type: ObjectId, ref: 'Brand', required: true },
  // Brand-specific overrides
  defaultPrice: { type: Number, required: true },
  defaultDuration: { type: Number, required: true }, // in minutes
  skillLevel: {
    type: String,
    enum: ["beginner", "intermediate", "advanced", "expert"],
    default: "intermediate"
  },
  isAvailable: { type: Boolean, default: true },
  notes: { type: String }, // Brand-specific notes
  // IMMUTABLE AFTER CREATION
  createdById: { type: ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

#### 1.1.4 ServiceModelPricing Collection
**Purpose:** Model-specific pricing for services

```javascript
{
  _id: ObjectId,
  serviceBrandConfig: { type: ObjectId, ref: 'ServiceBrandConfigs', required: true },
  phoneModel: { type: ObjectId, ref: 'PhoneModel', required: true },
  // Model-specific pricing
  basePrice: { type: Number, required: true },
  laborCharge: { type: Number, required: true },
  partsEstimate: { type: Number, required: true },
  duration: { type: Number, required: true }, // in minutes
  isActive: { type: Boolean, default: true },
  // IMMUTABLE AFTER CREATION
  validFrom: { type: Date, default: Date.now },
  validTo: { type: Date },
  createdById: { type: ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
}
```

#### 1.1.5 ServiceRequiredParts Collection
**Purpose:** Bill of Materials (BOM) for services

```javascript
{
  _id: ObjectId,
  serviceTemplate: { type: ObjectId, ref: 'ServiceTemplates', required: true },
  part: { type: ObjectId, ref: 'Items', required: true },
  quantity: { type: Number, required: true },
  isOptional: { type: Boolean, default: false },
  isSerialized: { type: Boolean, default: false },
  condition: { 
    type: String, 
    enum: ["New", "Refurbished", "Used"],
    default: "New"
  },
  notes: { type: String },
  // IMMUTABLE AFTER CREATION
  version: { type: Number, default: 1 },
  createdById: { type: ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
}
```

### 1.2 Customer & Device Collections

#### 1.2.1 CustomerDevices Collection
**Purpose:** Extended device information for repair tracking

```javascript
{
  _id: ObjectId,
  customer: { type: ObjectId, ref: 'Customer', required: true },
  device: { type: ObjectId, ref: 'Device', required: true },
  // Extended device information
  imei: { type: String, unique: true }, // For phones
  meid: { type: String }, // Alternative identifier
  originalPurchaseDate: { type: Date },
  originalPurchasePrice: { type: Number },
  warrantyExpiry: { type: Date },
  deviceCondition: {
    type: String,
    enum: ["Excellent", "Good", "Fair", "Poor"],
    required: true
  },
  cosmeticIssues: [{ type: String }], // e.g., "Scratches on back", "Cracked corners"
  previousRepairs: [{ 
    serviceDate: Date,
    serviceType: String,
    technician: { type: ObjectId, ref: 'Employee' },
    notes: String
  }],
  // IMMUTABLE AFTER CREATION
  createdBy: { type: ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

### 1.3 Repair Job Collections

#### 1.3.1 DeviceIntake Collection
**Purpose:** Initial device intake and KYC process

```javascript
{
  _id: ObjectId,
  intakeNumber: { type: String, required: true, unique: true }, // e.g., "INT-2024-001"
  customerDevice: { type: ObjectId, ref: 'CustomerDevices', required: true },
  intakeDate: { type: Date, default: Date.now },
  intakeTechnician: { type: ObjectId, ref: 'Employee', required: true },
  // Device condition at intake
  physicalCondition: {
    screen: { type: String, enum: ["Perfect", "Minor scratches", "Cracked", "Shattered"] },
    body: { type: String, enum: ["Perfect", "Minor scratches", "Dents", "Severe damage"] },
    buttons: { type: String, enum: ["Working", "Sticky", "Not working"] },
    ports: { type: String, enum: ["Perfect", "Dusty", "Damaged"] },
    battery: { type: String, enum: ["Good", "Worn", "Swollen", "Not holding charge"] }
  },
  reportedIssues: [{ 
    description: String,
    severity: { type: String, enum: ["Low", "Medium", "High", "Critical"] },
    customerReported: { type: Boolean, default: true }
  }],
  // Risk assessment
  riskLevel: { 
    type: String, 
    enum: ["Low", "Medium", "High"], 
    default: "Medium" 
  },
  isHighRiskDevice: { type: Boolean, default: false }, // Flag for stolen/blacklist check
  notes: { type: String },
  // IMMUTABLE AFTER CREATION
  customerId: { type: ObjectId, ref: 'Customer', required: true },
  deviceId: { type: ObjectId, ref: 'Device', required: true },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
}
```

#### 1.3.2 RepairJobs Collection
**Purpose:** Main repair job tracking

```javascript
{
  _id: ObjectId,
  jobNumber: { type: String, required: true, unique: true }, // e.g., "R-2024-001"
  deviceIntake: { type: ObjectId, ref: 'DeviceIntake', required: true },
  customer: { type: ObjectId, ref: 'Customer', required: true },
  device: { type: ObjectId, ref: 'Device', required: true },
  // Job status and timing
  status: {
    type: String,
    enum: [
      "Pending", 
      "Diagnosing", 
      "Quoted", 
      "Approved", 
      "In Progress", 
      "Quality Check", 
      "Completed", 
      "Ready for Delivery", 
      "Delivered", 
      "Cancelled",
      "Rework"
    ],
    default: "Pending"
  },
  priority: { 
    type: String, 
    enum: ["Low", "Medium", "High", "Emergency"], 
    default: "Medium" 
  },
  // Timeline
  intakeDate: { type: Date, default: Date.now },
  estimatedCompletionDate: Date,
  actualCompletionDate: Date,
  diagnosisDate: Date,
  quotedDate: Date,
  approvedDate: Date,
  startedDate: Date,
  completedDate: Date,
  
  // Financials
  quotedAmount: Number,
  approvedAmount: Number,
  finalAmount: Number,
  paymentStatus: {
    type: String,
    enum: ["Unpaid", "Deposit", "Partial", "Full", "Overpaid"],
    default: "Unpaid"
  },
  depositAmount: { type: Number, default: 0 },
  // IMMUTABLE AFTER CREATION
  createdBy: { type: ObjectId, ref: 'User', required: true },
  assignedTechnician: { type: ObjectId, ref: 'Employee' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

#### 1.3.3 JobServices Collection
**Purpose:** Services performed in a repair job

```javascript
{
  _id: ObjectId,
  repairJob: { type: ObjectId, ref: 'RepairJobs', required: true },
  serviceTemplate: { type: ObjectId, ref: 'ServiceTemplates', required: true },
  serviceBrandConfig: { type: ObjectId, ref: 'ServiceBrandConfigs' },
  serviceModelPricing: { type: ObjectId, ref: 'ServiceModelPricing' },
  // Service details
  serviceName: { type: String, required: true },
  description: { type: String },
  status: {
    type: String,
    enum: ["Not Started", "In Progress", "Completed", "Failed"],
    default: "Not Started"
  },
  technician: { type: ObjectId, ref: 'Employee' },
  startTime: Date,
  endTime: Date,
  // Pricing at service time
  quotedPrice: { type: Number, required: true },
  actualPrice: { type: Number },
  duration: { type: Number }, // in minutes
  notes: { type: String },
  // Quality control
  passedQualityCheck: { type: Boolean, default: false },
  qualityCheckNotes: String,
  photos: [{ type: String }], // Before/after photos
  // IMMUTABLE AFTER CREATION
  createdBy: { type: ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}
```

#### 1.3.4 JobParts Collection
**Purpose:** Parts used in repair jobs

```javascript
{
  _id: ObjectId,
  repairJob: { type: ObjectId, ref: 'RepairJobs', required: true },
  jobService: { type: ObjectId, ref: 'JobServices' }, // Optional: which service used this part
  // Part information
  stockItem: { type: ObjectId, ref: 'SerializedStock' }, // For serialized parts
  stockItemNS: { type: ObjectId, ref: 'NonSerializedStock' }, // For non-serialized parts
  part: { type: ObjectId, ref: 'Items', required: true },
  partNumber: { type: String, required: true },
  partName: { type: String, required: true },
  // Usage details
  quantity: { type: Number, required: true },
  isSerialized: { type: Boolean, default: false },
  serialNumbers: [{ type: String }], // For serialized items
  // Cost at time of use
  unitCost: { type: Number, required: true },
  totalCost: { type: Number, required: true },
  // Part condition
  condition: {
    type: String,
    enum: ["New", "Refurbished", "Used"],
    default: "New"
  },
  // Substitution details
  isSubstitute: { type: Boolean, default: false },
  substituteReason: String,
  originalPart: { type: ObjectId, ref: 'Items' }, // If substitute
  // Inventory tracking
  batchNumber: { type: String },
  expiryDate: Date,
  // IMMUTABLE AFTER CREATION
  usageDate: { type: Date, default: Date.now },
  createdBy: { type: ObjectId, ref: 'User', required: true },
  notes: String
}
```

### 1.4 Technician & Commission Collections

#### 1.4.1 TechnicianCommissionRules Collection
**Purpose:** Commission calculation rules for technicians

```javascript
{
  _id: ObjectId,
  name: { type: String, required: true }, // e.g., "Standard Commission 2024"
  description: { type: String },
  isActive: { type: Boolean, default: true },
  validFrom: { type: Date, default: Date.now },
  validTo: { type: Date },
  // Commission structure
  baseCommission: { type: Number, default: 0 }, // Percentage
  seniorityBonus: { type: Number, default: 0 }, // Percentage
  performanceBonus: { type: Number, default: 0 }, // Percentage
  // Service-specific commissions
  serviceCommissions: [{
    serviceTemplate: { type: ObjectId, ref: 'ServiceTemplates' },
    commissionRate: { type: Number, required: true },
    minAmount: Number,
    maxAmount: Number
  }],
  // Tiered commissions
  tieredCommissions: [{
    minAmount: { type: Number, required: true },
    maxAmount: Number,
    rate: { type: Number, required: true }
  }],
  // Quality bonuses/penalties
  qualityBonus: { type: Number, default: 0 }, // Percentage
  qualityPenalty: { type: Number, default: 0 }, // Percentage
  reworkPenalty: { type: Number, default: 0 }, // Percentage
  clawbackRules: [{
    condition: String, // e.g., "Within 30 days", "Customer complaint"
    clawbackPercentage: { type: Number, required: true },
    maxClawbackAmount: Number
  }],
  // IMMUTABLE AFTER CREATION
  createdBy: { type: ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
}
```

#### 1.4.2 JobTechnicianCommissions Collection
**Purpose:** Commission snapshots for completed jobs

```javascript
{
  _id: ObjectId,
  repairJob: { type: ObjectId, ref: 'RepairJobs', required: true },
  technician: { type: ObjectId, ref: 'Employee', required: true },
  commissionRule: { type: ObjectId, ref: 'TechnicianCommissionRules', required: true },
  // Commission calculation
  baseAmount: { type: Number, required: true },
  commissionRate: { type: Number, required: true },
  commissionAmount: { type: Number, required: true },
  // Quality adjustments
  qualityBonus: { type: Number, default: 0 },
  qualityPenalty: { type: Number, default: 0 },
  // Bonuses
  seniorityBonus: { type: Number, default: 0 },
  performanceBonus: { type: Number, default: 0 },
  // Final commission
  finalCommission: { type: Number, required: true },
  status: {
    type: String,
    enum: ["Pending", "Paid", " clawback"],
    default: "Pending"
  },
  clawbackAmount: { type: Number, default: 0 },
  clawbackReason: String,
  paymentDate: Date,
  // IMMUTABLE AFTER CREATION
  calculatedAt: { type: Date, default: Date.now },
  calculatedBy: { type: ObjectId, ref: 'User', required: true }
}
```

### 1.5 Audit & Financial Collections

#### 1.5.1 RepairFinancialSnapshots Collection
**Purpose:** Immutable financial snapshots at key points

```javascript
{
  _id: ObjectId,
  repairJob: { type: ObjectId, ref: 'RepairJobs', required: true },
  snapshotType: {
    type: String,
    enum: ["Quotation", "Approval", "Start", "Completion", "Delivery"],
    required: true
  },
  snapshotData: {
    services: [{
      serviceId: ObjectId,
      serviceName: String,
      quotedPrice: Number,
      actualPrice: Number,
      technicianCommission: Number
    }],
    parts: [{
      partId: ObjectId,
      partName: String,
      quantity: Number,
      unitCost: Number,
      totalCost: Number
    }],
    totals: {
      subtotal: Number,
      tax: Number,
      total: Number,
      deposit: Number,
      balanceDue: Number
    }
  },
  // IMMUTABLE AFTER CREATION
  snapshotDate: { type: Date, default: Date.now },
  createdBy: { type: ObjectId, ref: 'User', required: true }
}
```

#### 1.5.2 RepairAuditTrail Collection
**Purpose:** Detailed audit trail for all repair activities

```javascript
{
  _id: ObjectId,
  repairJob: { type: ObjectId, ref: 'RepairJobs' },
  deviceIntake: { type: ObjectId, ref: 'DeviceIntake' },
  jobService: { type: ObjectId, ref: 'JobServices' },
  jobPart: { type: ObjectId, ref: 'JobParts' },
  // Activity details
  action: {
    type: String,
    enum: [
      "DEVICE_INTAKE_CREATED",
      "JOB_CREATED",
      "DIAGNOSIS_COMPLETED",
      "QUOTATION_GENERATED",
      "APPROVAL_RECEIVED",
      "SERVICE_STARTED",
      "SERVICE_COMPLETED",
      "PART_USED",
      "QUALITY_CHECK_PASSED",
      "QUALITY_CHECK_FAILED",
      "JOB_COMPLETED",
      "DELIVERY_INITIATED",
      "DELIVERY_COMPLETED",
      "CANCELLED",
      "REWORK_INITIATED",
      "PRICE_ADJUSTMENT",
      "PART_SUBSTITUTION",
      "TECHNICIAN_ASSIGNED",
      "COMMISSION_CALCULATED"
    ],
    required: true
  },
  description: { type: String, required: true },
  // User information
  userId: { type: ObjectId, ref: 'User' },
  technicianId: { type: ObjectId, ref: 'Employee' },
  // Changes made
  oldValue: { type: Object },
  newValue: { type: Object },
  // Additional context
  ipAddress: String,
  userAgent: String,
  // IMMUTABLE AFTER CREATION
  timestamp: { type: Date, default: Date.now }
}
```

## 2. Repair Lifecycle Workflows

### 2.1 Device Intake & KYC

**Process Flow:**
1. **Create Device Intake:**
   - Scan device IMEI/serial number
   - Verify against customer's devices
   - Check for blacklist/stolen status (high-risk flag)
   - Capture physical condition with photos

2. **Initial Assessment:**
   - Document all visible issues
   - Note cosmetic damage
   - Check for water damage indicators
   - Verify functionality of basic features

3. **Risk Assessment:**
   - Low Risk: Standard processing
   - Medium Risk: Manager approval required
   - High Risk: Security verification required, police report if stolen

**Edge Cases:**
- **IMEI not found:** Create new device record with customer info
- **Blacklisted device:** Refuse service or require additional verification
- **Multiple IMEIs:** Log all for tracking
- **Password-locked device:** Document and require customer to unlock or provide written consent

### 2.2 Diagnosis Process

**Process Flow:**
1. **Initial Diagnosis:**
   - Assign technician with appropriate skill level
   - Complete diagnostic checklist
   - Test all reported issues
   - Discover additional problems

2. **Diagnosis Documentation:**
   - Record all findings
   - Take before/after photos
   - Update job status to "Diagnosing"
   - Estimate parts and labor

3. **Customer Communication:**
   - Prepare detailed diagnosis report
   - Quote additional issues found
   - Get approval for additional work

**Edge Cases:**
- **No fault found:** Document and charge diagnostic fee
- **Multiple issues found:** Prioritize and quote all
- **Parts unavailable:** Notify customer and provide alternatives
- **Device cannot be repaired:** Offer trade-in or data recovery options

### 2.3 Quotation & Approval

**Process Flow:**
1. **Quotation Generation:**
   - Use service model pricing
   - Apply current technician rates
   - Include parts costs at reservation time
   - Calculate tax and totals

2. **Quotation Review:**
   - Manager review for high-value jobs
   - Verify parts availability
   - Check technician availability
   - Validate pricing rules

3. **Customer Approval:**
   - Send quotation to customer
   - Track approval status
   - Deposit collection if required
   - Update job status to "Approved"

**Edge Cases:**
- **Price increase:** Get explicit approval before proceeding
- **Parts price changed:** Use quoted price or notify customer
- **Customer rejects quotation:** Update status and archive
- **Multiple approval levels:** Route through appropriate hierarchy

### 2.4 Parts Reservation & Cost Locking

**Process Flow:**
1. **Parts Reservation:**
   - Check inventory availability
   - Reserve parts for the job
   - Update stock status to "On Hold"
   - Create stock ledger entry

2. **Cost Locking:**
   - Capture current part costs
   - Create financial snapshot
   - Prevent price changes for this job
   - Document locked costs

3. **Substitution Handling:**
   - If part unavailable, find substitute
   - Get customer approval for substitution
   - Update pricing accordingly
   - Document substitution reason

**Edge Cases:**
- **Out-of-stock parts:** Backorder or substitute
- **Price fluctuations:** Use locked costs
- **Damaged parts:** Replace from inventory
- **Special order parts:** Track expected arrival date

### 2.5 Repair Execution

**Process Flow:**
1. **Job Assignment:**
   - Assign appropriate technician
   - Confirm parts availability
   - Schedule repair time
   - Update job status

2. **Service Execution:**
   - Follow service workflow steps
   - Document each step
   - Take progress photos
   - Track time spent

3. **Quality Control:**
   - Perform quality checks at each stage
   - Test functionality thoroughly
   - Document test results
   - Get sign-off for completed work

**Edge Cases:**
- **Technician unavailable:** Reassign promptly
- **Difficulty encountered:** Escalate to senior technician
- **Parts failure:** Replace and document
- **Customer requests changes:** Process as variation order

### 2.6 Quality Assurance

**Process Flow:**
1. **Final Inspection:**
   - Complete comprehensive checklist
   - Test all repaired functions
   - Verify cosmetic appearance
   - Check for new damage

2. **Quality Testing:**
   - Perform diagnostic tests
   - Run benchmark tests if applicable
   - Check battery health
   - Verify all features work

3. **Approval Process:**
   - Quality technician signs off
   - Manager review for high-value jobs
   - Update quality status
   - Prepare for delivery

**Edge Cases:**
- **Quality check fails:** Initiate rework process
- **New issues discovered:** Update quotation and get approval
- **Customer concerns:** Address before delivery
- **Warranty testing:** Document results

### 2.7 Delivery & Handover

**Process Flow:**
1. **Preparation:**
   - Clean device thoroughly
   - Install protective accessories if included
   - Package securely
   - Prepare documentation

2. **Customer Handover:**
   - Verify customer identity
   - Demonstrate repaired functionality
   - Explain warranty terms
   - Get delivery confirmation

3. **Post-Delivery:**
   - Update job status to "Delivered"
   - Process final payment
   - Schedule follow-up if needed
   - Archive job documents

**Edge Cases:**
- **Customer not satisfied:** Initiate rework process
- **Payment issues:** Resolve before release
- **Documentation missing:** Provide copies
- **Post-delivery issues:** Create warranty claim

### 2.8 Warranty & Rework Handling

**Process Flow:**
1. **Warranty Claim:**
   - Validate warranty period
   - Verify issue is covered
   - Document failure details
   - Approve warranty repair

2. **Rework Process:**
   - Create new job for rework
   - Assign to senior technician
   - Use original job reference
   - Update commission clawback if applicable

3. **Final Resolution:**
   - Complete rework to satisfaction
   - Update warranty status
   - Process any refunds
   - Document resolution

**Edge Cases:**
- **Manufacturing defect:** Handle under supplier warranty
- **Customer misuse:** Charge for repair
- **Multiple failures:** Escalate to supplier
- **Warranty expiry:** Offer paid repair options

### 2.9 Cancellation & Partial Repairs

**Process Flow:**
1. **Cancellation Request:**
   - Verify cancellation reason
   - Calculate refund amount
   - Unreserve parts
   - Update inventory status

2. **Partial Completion:**
   - Document completed work
   - Calculate partial payment
   - Prepare device for return
   - Get customer confirmation

3. **Final Settlement:**
   - Process refunds
   - Update job status
   - Archive documents
   - Notify relevant parties

**Edge Cases:**
- **Customer cancellation:** Apply cancellation fee if applicable
- **Business cancellation:** Full refund with apology
- **Device pickup not arranged:** Storage charges apply
- **Parts already ordered:** Restocking fee may apply

## 3. Inventory & Cost Rules

### 3.1 Cost Locking Mechanism

- **Intake Lock:** Parts costs are locked at device intake for high-value items
- **Diagnosis Lock:** Costs locked after diagnosis for all jobs
- **Quotation Lock:** Final cost lock when quotation is approved
- **Versioned Costs:** Maintain historical cost snapshots

### 3.2 Serialized vs Non-Serialized Handling

**Serialized Items:**
- Track by unique IMEI/serial number
- One-to-one relationship with stock
- Direct assignment to jobs
- Individual cost tracking
- Warranty tracking per unit

**Non-Serialized Items:**
- Track by batch/lot
- Quantity-based tracking
- FIFO (First In, First Out) consumption
- Weighted average cost calculation
- Batch-level warranty

### 3.3 Inventory Valuation Methods

- **FIFO (First In, First Out):** Default for non-serialized items
- **Weighted Average:** For items with frequent price changes
- **Specific Identification:** For high-value serialized items
- **Standard Cost:** For planning purposes

### 3.4 Stock Movement Rules

- **Reservation:** Parts moved to "On Hold" status when job approved
- **Consumption:** Parts moved to "Used" status when installed
- **Return:** Parts returned to "Available" status if job cancelled
- **Adjustment:** Manual adjustments require manager approval
- **Transfer:** Inter-branch transfers require approval

### 3.5 Backorder & Substitution Rules

**Backorders:**
- Create backorder record when stock insufficient
- Notify customer of expected delivery time
- Update job timeline accordingly
- Prioritize based on job status

**Substitutions:**
- Only allow with customer approval
- Document substitution reason
- Maintain original part cost for pricing
- Update warranty terms if applicable

## 4. Financial & Commission Rules

### 4.1 Service Price Calculation

**Base Price Calculation:**
1. Use ServiceModelPricing for model-specific rates
2. Apply seniority/technician skill adjustments
3. Add parts cost at reservation time
4. Calculate tax based on location
5. Apply any valid discounts

**Price Lock Timing:**
- Diagnostic fees: Locked at diagnosis
- Parts costs: Locked at reservation
- Labor costs: Locked at approval
- Final price: Locked at job start

### 4.2 Profit Calculation

**Gross Profit:**
```
Total Revenue - (Parts Cost + Labor Cost)
```

**Net Profit:**
```
Gross Profit - (Warranty Reserves + Quality Costs + Overhead)
```

**Margin Tracking:**
- Service margin: (Labor Revenue / Labor Cost) - 1
- Parts margin: (Parts Revenue / Parts Cost) - 1
- Overall margin: Net Profit / Total Revenue

### 4.3 Commission Calculation

**Base Commission:**
- Apply technician's base rate to labor portion
- Add seniority bonus if applicable
- Add performance bonus if targets met

**Service-Specific Commissions:**
- Use serviceTemplate-specific rates if defined
- Apply tiered rates based on job value
- Cap maximum commission per job if specified

**Quality Adjustments:**
- Quality bonus: Add for perfect work
- Quality penalty: Deduct for defects found
- Rework penalty: Claw back commission for rework

### 4.4 Clawback Rules

**Automatic Clawbacks:**
- Within warranty period if issue reoccurs
- Customer complaint with valid reason
- Quality check failures

**Manual Clawbacks:**
- Technician error causing damage
- Excessive rework rates
- Customer satisfaction issues

** clawback Process:**
1. Document reason for clawback
2. Calculate clawback amount
3. Get manager approval
4. Process deduction from next payment
5. Update technician performance metrics

## 5. Explicit Anti-Patterns

### 5.1 Data Integrity Anti-Patterns

**❌ NO Recalculation of Historical Data:**
- Never recalculate historical prices or commissions from live tables
- Maintain immutable snapshots for historical accuracy
- Create new records for changes, don't modify old ones

**❌ NO Mixed Responsibility Collections:**
- Don't combine inventory, pricing, and commission in one collection
- Separate master data from transactional data
- Keep audit trails separate from operational data

**❌ NO String-Based Categories:**
- Don't use string fields for categories/types without validation
- Use reference IDs to category collections
- Implement enum validation for controlled values

### 5.2 Inventory Anti-Patterns

**❌ NO Batch Tracking for Serialized Items:**
- Don't group serialized items by batch for tracking
- Track each unique IMEI/serial individually
- Maintain one-to-one relationship with stock

**❌ NO Direct Stock Deletions:**
- Never delete stock records directly
- Use status changes to mark items as obsolete
- Create adjustment records for quantity changes

**❌ NO Price Updates on Historical Jobs:**
- Don't update prices on completed or in-progress jobs
- Use the price at the time of service
- Create price adjustment records for future services

### 5.3 Business Logic Anti-Patterns

**❌ NO Hardcoded Business Rules:**
- Don't embed business rules in application code
- Use configuration collections for rules
- Allow rules to be updated without code changes

**❌ NO Unvalidated User Input:**
- Never trust user input without validation
- Implement server-side validation for all fields
- Use schema validation at database level

**❌ NO Inconsistent State Transitions:**
- Don't allow arbitrary status changes
- Implement workflow state machines
- Validate all state transitions

## 6. Implementation Guidelines

### 6.1 Indexing Strategy

```javascript
// Critical indexes for performance
RepairJobs: { jobNumber: 1, status: 1, customer: 1, createdAt: -1 }
DeviceIntake: { intakeNumber: 1, customerDevice: 1, riskLevel: 1 }
JobServices: { repairJob: 1, serviceTemplate: 1, status: 1 }
JobParts: { repairJob: 1, part: 1, stockItem: 1 }
StockLedger: { item_id: 1, movementType: 1, createdAt: -1 }
```

### 6.2 Data Validation

All schemas should implement:
- Required field validation
- Data type validation
- Enum validation for controlled values
- Reference validation for foreign keys
- Business rule validation

### 6.3 Error Handling

Implement comprehensive error handling:
- Validation errors with specific field messages
- Business rule violation errors
- Inventory constraint errors
- Permission errors
- System errors with logging

### 6.4 Security Considerations

- Role-based access control for all operations
- Field-level security for sensitive data
- Audit all data access and modifications
- Encrypt sensitive fields at rest
- Implement rate limiting for API endpoints

This specification provides a comprehensive foundation for implementing the Mobile Repair Module with deterministic, ERP-grade functionality that ensures data integrity, traceability, and business rule enforcement.
