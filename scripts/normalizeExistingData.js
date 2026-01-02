/**
 * Migration Script: Normalize Existing Data
 * 
 * Purpose: Convert existing item names, variant names, and usernames to proper casing
 * 
 * WARNING: 
 * - Create a backup before running
 * - Run during off-peak hours
 * - Monitor for duplicate conflicts
 */

const mongoose = require('mongoose');
const Item = require('../models/Items');
const ItemVariant = require('../models/ItemVariantSchema');
const User = require('../models/User');

// Use the same database URI as the main application
const localUri = 'mongodb://localhost:27017/ishopmaster';
const mongoUri = 'mongodb+srv://jafranjemal:jafran123@cluster0.yai9p.mongodb.net/ishopmaster?retryWrites=true&w=majority';
const MONGODB_URI = process.env.NODE_ENV !== 'production' ? mongoUri : localUri;

async function normalizeItemNames() {
    console.log('\n🔧 Normalizing Item Names to UPPERCASE...');

    try {
        const items = await Item.find({});
        let updated = 0;
        let skipped = 0;
        const conflicts = [];

        for (const item of items) {
            const originalName = item.itemName;
            const normalizedName = originalName.toUpperCase();

            if (originalName !== normalizedName) {
                // Check for duplicate before update
                const duplicate = await Item.findOne({
                    itemName: normalizedName,
                    _id: { $ne: item._id }
                });

                if (duplicate) {
                    conflicts.push({
                        original: originalName,
                        normalized: normalizedName,
                        conflictsWith: duplicate._id
                    });
                    console.log(`   ⚠️  CONFLICT: "${originalName}" → "${normalizedName}" (exists as ${duplicate._id})`);
                    skipped++;
                } else {
                    try {
                        item.itemName = normalizedName;
                        await item.save({ validateBeforeSave: false }); // Skip validation
                        console.log(`   ✅ Updated: "${originalName}" → "${normalizedName}"`);
                        updated++;
                    } catch (saveError) {
                        console.log(`   ⚠️  VALIDATION ERROR: "${originalName}" - ${saveError.message}`);
                        skipped++;
                    }
                }
            } else {
                skipped++;
            }
        }

        console.log(`\n✅ Items: ${updated} updated, ${skipped} skipped`);

        if (conflicts.length > 0) {
            console.log(`\n⚠️  ${conflicts.length} conflicts detected. Manual resolution required:`);
            console.table(conflicts);
        }

        return { updated, skipped, conflicts };
    } catch (error) {
        console.error('❌ Error normalizing item names:', error);
        throw error;
    }
}

async function normalizeVariantNames() {
    console.log('\n🔧 Normalizing Variant Names to UPPERCASE...');

    try {
        const variants = await ItemVariant.find({});
        let updated = 0;
        let skipped = 0;

        for (const variant of variants) {
            const originalName = variant.variantName;
            const normalizedName = originalName.toUpperCase();

            if (originalName !== normalizedName) {
                variant.variantName = normalizedName;
                await variant.save();
                console.log(`   ✅ Updated: "${originalName}" → "${normalizedName}"`);
                updated++;
            } else {
                skipped++;
            }
        }

        console.log(`\n✅ Variants: ${updated} updated, ${skipped} skipped`);
        return { updated, skipped };
    } catch (error) {
        console.error('❌ Error normalizing variant names:', error);
        throw error;
    }
}

async function normalizeUsernames() {
    console.log('\n🔧 Normalizing Usernames to lowercase...');

    try {
        const users = await User.find({});
        let updated = 0;
        let skipped = 0;
        const conflicts = [];

        for (const user of users) {
            const originalUsername = user.username;
            const normalizedUsername = originalUsername.toLowerCase();

            if (originalUsername !== normalizedUsername) {
                // Check for duplicate before update
                const duplicate = await User.findOne({
                    username: normalizedUsername,
                    _id: { $ne: user._id }
                });

                if (duplicate) {
                    conflicts.push({
                        original: originalUsername,
                        normalized: normalizedUsername,
                        conflictsWith: duplicate._id
                    });
                    console.log(`   ⚠️  CONFLICT: "${originalUsername}" → "${normalizedUsername}" (exists as ${duplicate._id})`);
                    skipped++;
                } else {
                    user.username = normalizedUsername;
                    await user.save();
                    console.log(`   ✅ Updated: "${originalUsername}" → "${normalizedUsername}"`);
                    updated++;
                }
            } else {
                skipped++;
            }
        }

        console.log(`\n✅ Users: ${updated} updated, ${skipped} skipped`);

        if (conflicts.length > 0) {
            console.log(`\n⚠️  ${conflicts.length} conflicts detected. Manual resolution required:`);
            console.table(conflicts);
        }

        return { updated, skipped, conflicts };
    } catch (error) {
        console.error('❌ Error normalizing usernames:', error);
        throw error;
    }
}

async function generateReport(results) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY');
    console.log('='.repeat(60));

    console.log('\n📦 Items:');
    console.log(`   Updated: ${results.items.updated}`);
    console.log(`   Skipped: ${results.items.skipped}`);
    console.log(`   Conflicts: ${results.items.conflicts.length}`);

    console.log('\n🔀 Variants:');
    console.log(`   Updated: ${results.variants.updated}`);
    console.log(`   Skipped: ${results.variants.skipped}`);

    console.log('\n👤 Users:');
    console.log(`   Updated: ${results.users.updated}`);
    console.log(`   Skipped: ${results.users.skipped}`);
    console.log(`   Conflicts: ${results.users.conflicts.length}`);

    const totalConflicts = results.items.conflicts.length + results.users.conflicts.length;

    if (totalConflicts > 0) {
        console.log('\n⚠️  ACTION REQUIRED:');
        console.log(`   ${totalConflicts} conflicts need manual resolution`);
        console.log('   Review duplicates and merge/delete as needed');
    }

    console.log('\n' + '='.repeat(60));
}

async function main() {
    console.log('🚀 Starting Data Normalization Migration...\n');
    console.log(`📍 Connecting to: ${MONGODB_URI}\n`);

    try {
        // Connect to MongoDB
        await mongoose.connect(MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Connected to MongoDB\n');

        const results = {
            items: await normalizeItemNames(),
            variants: await normalizeVariantNames(),
            users: await normalizeUsernames()
        };

        await generateReport(results);

        console.log('\n✅ Migration completed successfully!');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log('\n👋 Disconnected from MongoDB');
    }
}

// Run migration
if (require.main === module) {
    main().catch(console.error);
}

module.exports = { normalizeItemNames, normalizeVariantNames, normalizeUsernames };
