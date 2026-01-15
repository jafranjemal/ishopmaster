# REPAIR MODULE FINANCIAL EVENTS SPECIFICATION
## COMPREHENSIVE ACCOUNTING RULES & IMMUTABILITY GUARANTEES

## COGS POSTING RULES (INVENTORY → EXPENSE)

### When COGS is Posted
```markdown
COGS (Cost of Goods Sold) is posted when:
1. repair_part_allocation.allocation_status = 'CONSUMED'
2. repair_job_service.status = 'COMPLETED'
3. Both conditions must be true for COGS recognition

Timing: COGS is posted at job completion, not at part consumption
```

### COGS Posting Process
```markdown
1. Job completion triggers COGS calculation
2. System sums all CONSUMED repair_part_allocation records
3. COGS amount = Σ(total_cost_snapshot for all CONSUMED allocations)
4. Accounting entry created:
   - Debit: Cost of Goods Sold (COGS)
   - Credit: Inventory Asset Account
5. Posting timestamp recorded in audit trail
```

### COGS Immutability Rules
```markdown
Once COGS is posted:
- COGS amount cannot be modified
- Underlying cost snapshots cannot be changed
- Inventory valuation adjustment is permanent
- Corrections require reversing entries with new COGS posts
```

## SERVICE REVENUE RECOGNITION RULES

### When Service Revenue is Recognized
```markdown
Service revenue is recognized when:
1. repair_job.current_status = 'DELIVERED'
2. Customer has accepted the completed repair
3. Final payment amount is confirmed

Timing: Revenue recognized at delivery, not at approval or completion
```

### Revenue Recognition Process
```markdown
1. Job delivery triggers revenue recognition
2. System uses repair_job.total_final_amount
3. Revenue amount = total_final_amount (after any adjustments)
4. Accounting entry created:
   - Debit: Accounts Receivable (or Cash)
   - Credit: Service Revenue
5. Revenue recognition timestamp recorded
```

### Revenue Immutability Rules
```markdown
Once revenue is recognized:
- Revenue amount cannot be modified
- Customer invoice amount cannot change
- Payment terms become enforceable
- Adjustments require credit memo process
```

## ACCOUNTING BEHAVIOR FOR SPECIAL SCENARIOS

### Partial Repairs
```markdown
Financial Treatment:
- Revenue: Recognize only for completed services
- COGS: Recognize only for consumed parts
- Inventory: Release unused reserved parts
- Customer: Prorated charge for partial completion

Accounting Entries:
1. Revenue: Partial service revenue
   - Debit: Accounts Receivable
   - Credit: Service Revenue (partial)
2. COGS: Partial cost recognition
   - Debit: COGS (partial)
   - Credit: Inventory Asset
3. Inventory: Unused parts release
   - Debit: Inventory Asset
   - Credit: Inventory Reserve

Immutability:
- Partial amounts become immutable at delivery
- Original quotation remains unchanged for audit
```

### Cancellations Before Consumption
```markdown
Financial Treatment:
- Revenue: $0 recognized (no service delivered)
- COGS: $0 recognized (no parts consumed)
- Inventory: Full restoration of reserved parts
- Customer: Potential cancellation fee

Accounting Entries:
1. Cancellation fee (if applicable)
   - Debit: Accounts Receivable
   - Credit: Other Income
2. Inventory restoration
   - Debit: Inventory Asset
   - Credit: Inventory Reserve

Immutability:
- Cancellation event recorded permanently
- No revenue or COGS ever posted
```

### Cancellations After Consumption
```markdown
Financial Treatment:
- Revenue: $0 recognized (no service delivered)
- COGS: Full recognition (parts consumed)
- Inventory: No restoration (parts used)
- Customer: Full cost recovery attempt

Accounting Entries:
1. COGS recognition
   - Debit: COGS
   - Credit: Inventory Asset
2. Customer liability
   - Debit: Accounts Receivable
   - Credit: Customer Deposit Liability
3. Write-off (if uncollectible)
   - Debit: Bad Debt Expense
   - Credit: Accounts Receivable

Immutability:
- COGS amount immutable
- Consumed parts cannot be restored
- Customer liability recorded permanently
```

### Warranty Rework Jobs
```markdown
Financial Treatment:
- Revenue: $0 recognized (warranty obligation)
- COGS: Full recognition (new cost event)
- Inventory: New consumption from current stock
- Tier Constraint: Must use original tier or upgraded tier (if original out of stock)
- Upgrade Cost: Company absorbs cost difference if upgrading to higher tier
- Warranty: Reserve account utilization
```
Accounting Entries:
1. Warranty reserve utilization
   - Debit: Warranty Reserve
   - Credit: Warranty Liability
2. COGS for rework parts
   - Debit: COGS (Warranty)
   - Credit: Inventory Asset
3. Labor cost recognition
   - Debit: Warranty Expense
   - Credit: Accrued Liabilities

Immutability:
- Warranty costs linked to original job
- Original job financials remain unchanged
- New COGS amounts immutable at rework completion
```

## EVENT → ACCOUNTING IMPACT TABLE

| Event | Debit | Credit | Timing | Immutability |
|-------|-------|--------|--------|--------------|
| Job Approval | None | None | Immediate | N/A |
| Part Reservation | Inventory Reserve | Inventory Asset | Immediate | Reversible |
| Part Consumption | None | None | Immediate | Reversible until job completion |
| Job Completion | COGS | Inventory Asset | Job completion | Immutable |
| Job Delivery | Accounts Receivable | Service Revenue | Delivery | Immutable |
| Payment Received | Cash | Accounts Receivable | Payment | Immutable |
| Quotation Rejection | None | None | Rejection | N/A |
| Job Cancellation (pre-consumption) | Inventory Asset | Inventory Reserve | Cancellation | Immutable |
| Job Cancellation (post-consumption) | COGS | Inventory Asset | Cancellation | Immutable |
| Warranty Claim Approval | Warranty Expense | Warranty Reserve | Approval | Immutable |
| Warranty Rework Completion | COGS (Warranty) | Inventory Asset | Completion | Immutable |
| Correction Workflow | Correction Account | Original Account | Correction | New immutable record |
| Inventory Adjustment | Inventory Asset | Correction Account | Adjustment | Immutable |

## FINANCIAL IMMUTABILITY GUARANTEES

### Immutable Financial Elements
```markdown
1. COGS amounts once posted
2. Revenue amounts once recognized
3. Cost snapshots after CONSUMED status
4. Price snapshots after APPROVED status
5. Warranty reserve allocations
6. Customer invoice amounts after delivery
7. Payment amounts after posting
8. Correction amounts after processing
```

### Mutability Rules with Constraints
```markdown
1. Quotations: Modifiable until APPROVED status
2. Reservations: Reversible until CONSUMED status
3. Job estimates: Adjustable until APPROVED status
4. Technician assignments: Changeable until IN_PROGRESS
```

### Financial Correction Procedures
```markdown
1. Identify incorrect financial record
2. Create correction audit trail entry
3. Post reversing entry (if needed)
4. Post correct entry with new timestamp
5. Link correction to original record
6. Preserve original record unchanged
7. Mark original as corrected (not deleted)
```

## WARRANTY FINANCIAL IMPACT DETAILS

### Warranty Reserve Accounting
```markdown
Initial Setup:
- Debit: Warranty Expense
- Credit: Warranty Reserve

Claim Processing:
- Debit: Warranty Reserve
- Credit: Warranty Liability

Rework Completion:
- Debit: Warranty Liability
- Credit: Cash/Accounts Payable
```

### Warranty Cost Allocation
```markdown
Original Job Impact:
- Original job revenue remains unchanged
- Original job COGS remains unchanged
- Original job profitability adjusted for rework costs
- Original technician quality metrics affected

Rework Job Impact:
- New COGS recorded for rework parts
- Labor costs recorded as warranty expense
- No new revenue recognized
- Technician commission at reduced rate
```

### Warranty Period Extensions
```markdown
Financial Impact:
- No additional revenue recognized
- Extended warranty liability period
- Potential increase in warranty reserve
- No change to original warranty accounting
```

## INVENTORY VALUATION IMPACT

### FIFO Inventory Valuation
```markdown
Valuation Rules:
- Inventory valued at oldest purchase cost first
- COGS reflects actual historical costs
- Inventory asset account updated on consumption
- Valuation reports use FIFO cost basis
```

### Serialized Inventory Valuation
```markdown
Valuation Rules:
- Each item valued at individual purchase cost
- COGS reflects exact item cost
- Inventory asset reduced by exact amount
- Serial number tracking for audit
```

### Inventory Correction Impact
```markdown
Correction Accounting:
- Debit/Credit: Inventory Adjustment Account
- Offset: Specific inventory batch or item
- Audit trail: Before/after valuation
- Reporting: Separate correction category
```

## AUDIT TRAIL REQUIREMENTS FOR FINANCIAL EVENTS

### Mandatory Financial Audit Events
```markdown
1. COGS posting events
2. Revenue recognition events
3. Inventory valuation changes
4. Warranty reserve transactions
5. Correction workflow executions
6. Financial state transitions
7. Payment processing events
8. Cancellation financial impact
```

### Financial Audit Record Content
```markdown
Required Fields:
- event_type: String (enum)
- financial_amount: Decimal
- before_amount: Decimal (nullable)
- after_amount: Decimal (nullable)
- account_affected: String
- related_entity_id: UUID
- timestamp: DateTime
- actor_id: UUID (nullable)
- correction_reference: UUID (nullable)
```

### Financial Audit Retention
```markdown
Retention Periods:
- COGS records: 7 years
- Revenue records: 7 years
- Inventory valuation: 5 years
- Warranty transactions: Permanent
- Correction records: Permanent
```

## FINANCIAL REPORTING REQUIREMENTS

### Standard Financial Reports
```markdown
1. Repair Revenue by Service Category
2. COGS by Service Type
3. Gross Margin by Technician
4. Warranty Cost Analysis
5. Inventory Turnover for Repair Parts
6. Cancellation Financial Impact
7. Correction Frequency Report
```

### Report Frequency
```markdown
- Daily: COGS and revenue summaries
- Weekly: Inventory valuation reports
- Monthly: Full financial analysis
- Quarterly: Warranty reserve analysis
- Annually: Comprehensive audit reports
```

### Report Immutability
```markdown
- Published reports become immutable
- Report versions tracked separately
- Corrections create new report versions
- Original reports preserved for audit
```

This financial events specification provides comprehensive accounting rules, immutability guarantees, and audit requirements for the Mobile Repair Module, ensuring full compliance with ERP-grade financial controls.
