const Item = require('../models/Items');
const ItemVariant = require('../models/ItemVariantSchema');

class InventoryValidationService {

    /**
     * Validates that an item's barcode is compliant with its variant status.
     * - If an item has variants, its barcode must be null.
     * - If an item is being updated and a barcode is provided, ensure no variants exist for it.
     * @param {object} productData - The product data from the request body.
     * @param {string|null} [productId] - The ID of the existing product if it's an update, otherwise null for new product.
     * @returns {Promise<void>} - Throws an error if validation fails.
     */
    static async validateItemBarcodeAndVariantCompliance(productData, productId = null) {
        // 1. If no barcode is provided in the update/creation, skip validation
        if (!productData.barcode) return;

        if (productId) {
            // --- UPDATE FLOW ---
            const existingItem = await Item.findById(productId);
            if (!existingItem) throw new Error('Product not found.');

            // 2. If the barcode hasn't changed, skip validation (Allow image/other updates)
            if (existingItem.barcode === productData.barcode) return;

            // 3. If barcode IS changing, check for REAL variants
            // We look for variants that are NOT 'Default' or count if there's more than 1
            const variants = await ItemVariant.find({ item_id: productId });

            // If there are multiple variants, or 1 variant that isn't the "Default" one
            const hasRealVariants = variants.length > 1 ||
                (variants.length === 1 && variants[0].variantName !== 'Default');

            if (hasRealVariants) {
                throw new Error('Barcode cannot be changed on a product that has multiple variants.');
            }
        } else {
            // --- NEW ITEM FLOW ---
            // For a brand new item, we just check if the user is trying to add a barcode 
            // while somehow sending variant data (rare, but good for safety)
            if (productData.hasVariants && productData.barcode) {
                throw new Error('Base barcode cannot be set if you are creating multiple variants.');
            }
        }
    }

    /**
     * Validates that a variant can be created/updated based on parent item and other variants.
     * - Parent item must not have a template-level barcode.
     * - Variant SKU must be unique among other variants for the same item.
     * - Variant barcode must be unique among other variants for the same item.
     * - Variant barcode must not be the same as parent item's barcode.
     * @param {string} item_id - The ID of the parent item.
     * @param {object} variantData - The variant data from the request body.
     * @param {string|null} [variantIdToUpdate] - The ID of the existing variant if it's an update, otherwise null for creation.
     * @returns {Promise<void>} - Throws an error if validation fails.
     */
    static async validateVariantData(item_id, variantData, variantIdToUpdate = null) {
        const item = await Item.findById(item_id);
        if (!item) {
            throw new Error("Base Item not found");
        }

        // Rule 1: Ensure parent item has no barcode set
        // if (item.barcode) {
        //     throw new Error("Cannot create/update a variant for an item that already has a template-level barcode. Clear the barcode on the base item first.");
        // }

        const queryFilter = { item_id: item_id };
        if (variantIdToUpdate) {
            queryFilter._id = { $ne: variantIdToUpdate }; // Exclude self if updating
        }

        // Rule 2: Ensure SKU for this variant is unique
        if (variantData.sku) {
            const existingSkuVariant = await ItemVariant.findOne({ ...queryFilter, sku: variantData.sku });
            if (existingSkuVariant) {
                throw new Error(`SKU '${variantData.sku}' already exists for this item.`);
            }
        }

        // Rule 3: Ensure Barcode for this variant is unique
        if (variantData.barcode) {
            const existingBarcodeVariant = await ItemVariant.findOne({ ...queryFilter, barcode: variantData.barcode });
            if (existingBarcodeVariant) {
                throw new Error(`Barcode '${variantData.barcode}' already exists for this item.`);
            }

            // Rule 4: Ensure variant barcode is not the same as parent item's barcode (redundant if Rule 1 is enforced, but good for safety)
            if (variantData.barcode === item.barcode) {
                throw new Error("Variant barcode cannot be the same as the parent item's barcode.");
            }
        }
    }
}

module.exports = InventoryValidationService;


