# Database Migration Scripts

## normalizeExistingData.js

### Purpose
Normalize existing data to match new case-sensitivity rules:
- Item names → UPPERCASE
- Variant names → UPPERCASE  
- Usernames → lowercase

### Prerequisites
1. **Backup database** before running
2. Ensure `.env` file has correct `MONGODB_URI`
3. Run during **off-peak hours**

### Usage

```bash
# From API root directory
cd d:\JJSOFT_GLOBAL\MA-Iphone Solution\system\ishopmaster-api-before-multi-tenant\ishopmaster-api

# Install dependencies (if needed)
npm install

# Run migration
node scripts/normalizeExistingData.js
```

### What It Does

1. **Items**: Converts all `itemName` to UPPERCASE
   - Example: "iPhone 12" → "IPHONE 12"
   
2. **Variants**: Converts all `variantName` to UPPERCASE
   - Example: "iPhone 12 Pro - Gold" → "IPHONE 12 PRO - GOLD"
   
3. **Users**: Converts all `username` to lowercase
   - Example: "AdminUser" → "adminuser"

### Conflict Detection

The script automatically detects duplicates:

```
⚠️  CONFLICT: "iPhone 12" → "IPHONE 12" (exists as 507f1f77bcf86cd799439011)
```

**Manual resolution required** for conflicts:
1. Review conflicting records in database
2. Merge data if needed
3. Delete duplicate entry
4. Re-run migration

### Output Example

```
🚀 Starting Data Normalization Migration...

🔧 Normalizing Item Names to UPPERCASE...
   ✅ Updated: "iPhone 12 Pro" → "IPHONE 12 PRO"
   ✅ Updated: "Samsung Galaxy S21" → "SAMSUNG GALAXY S21"
   ⚠️  CONFLICT: "macbook air" → "MACBOOK AIR" (exists as ...)

✅ Items: 145 updated, 12 skipped

📊 MIGRATION SUMMARY
===========================================================
📦 Items:
   Updated: 145
   Skipped: 12
   Conflicts: 1

🔀 Variants:
   Updated: 67
   Skipped: 0

👤 Users:
   Updated: 3
   Skipped: 5
   Conflicts: 0
===========================================================
```

### Rollback

If issues occur:
1. Restore from backup
2. Review conflicts
3. Fix manually
4. Re-run migration

### Safety Features

- ✅ Dry-run mode (updates shown, not committed)
- ✅ Conflict detection before update
- ✅ Detailed logging
- ✅ Transaction-safe (per-document)

### Notes

- Script is idempotent (safe to run multiple times)
- Only updates records that need normalization
- Skips already-normalized records
