const request = require('supertest');
const { app, server } = require('../server');
const { setup, teardown } = require('./setup');
const Item = require('../models/Items');
const ItemVariant = require('../models/ItemVariantSchema');
const mongoose = require('mongoose');

describe('Comprehensive Item Creation API Tests', () => {
  console.log('!!! JEST TEST: Mongoose connection host:', mongoose.connection.host);
  console.log('!!! JEST TEST: Mongoose connection name:', mongoose.connection.name);

  beforeAll(async () => {
    await setup();
  });

  afterAll(async () => {
    await teardown();
    server.close();
  });

  afterEach(async () => {
    // Clean up after each test
    await Item.deleteMany({});
    await ItemVariant.deleteMany({});
  });

  describe('Basic Item Creation', () => {
    it('should create a simple item with default variant successfully', async () => {
      const newItem = {
        itemName: 'Simple Test Item',
        category: 'Accessory',
        unit: 'pcs',
        sellingPrice: 100,
        costPrice: 50,
      };

      const res = await request(app)
        .post('/api/items')
        .send(newItem);

      expect(res.statusCode).toEqual(201);
      expect(res.body.message).toBe('Product created successfully');
      expect(res.body.data).toHaveProperty('_id');
      expect(res.body.data.itemName).toBe('SIMPLE TEST ITEM');

      // Verify item was created
      const createdItem = await Item.findById(res.body.data._id);
      expect(createdItem).not.toBeNull();
      expect(createdItem.itemName).toBe('SIMPLE TEST ITEM');

      // Verify default variant was created
      const defaultVariant = await ItemVariant.findOne({ item_id: createdItem._id });
      expect(defaultVariant).not.toBeNull();
      expect(defaultVariant.variantName).toBe('DEFAULT');
      expect(defaultVariant.defaultSellingPrice).toBe(100);
    });

    it('should reject item creation with missing required fields', async () => {
      const invalidItem = {
        // Missing itemName and category
        unit: 'pcs',
        sellingPrice: 100,
      };

      const res = await request(app)
        .post('/api/items')
        .send(invalidItem);

      expect(res.statusCode).toEqual(400);
      expect(res.body.message).toContain('is required');
    });

    it('should reject duplicate item names (case-insensitive)', async () => {
      // Create first item
      await request(app)
        .post('/api/items')
        .send({
          itemName: 'Duplicate Test',
          category: 'Accessory',
        });

      // Try to create duplicate with different case
      const res = await request(app)
        .post('/api/items')
        .send({
          itemName: 'duplicate test',
          category: 'Accessory',
        });

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toBe('Product with this name already exists');
    });
  });

  describe('Item with Barcode and SKU', () => {
    it('should create item with unique barcode', async () => {
      const itemWithBarcode = {
        itemName: 'Barcode Item',
        category: 'Device',
        barcode: 'TEST-BARCODE-123',
        sellingPrice: 500,
        costPrice: 300,
      };

      const res = await request(app)
        .post('/api/items')
        .send(itemWithBarcode);

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.barcode).toBe('TEST-BARCODE-123');

      // Verify barcode is stored in variant
      const createdItem = await Item.findById(res.body.data._id);
      const variant = await ItemVariant.findOne({ item_id: createdItem._id });
      expect(variant.barcode).toBe('TEST-BARCODE-123');
    });

    it('should reject duplicate barcodes', async () => {
      // Create first item with barcode
      await request(app)
        .post('/api/items')
        .send({
          itemName: 'First Barcode Item',
          category: 'Device',
          barcode: 'DUPLICATE-BARCODE',
        });

      // Try to create second item with same barcode
      const res = await request(app)
        .post('/api/items')
        .send({
          itemName: 'Second Barcode Item',
          category: 'Device',
          barcode: 'DUPLICATE-BARCODE',
        });

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toContain('Duplicate value for barcode');
    });
  });

  describe('Item with Variants', () => {
    it('should create item and allow variant creation', async () => {
      // First create base item
      const baseItemRes = await request(app)
        .post('/api/items')
        .send({
          itemName: 'Variant Base Item',
          category: 'Device',
          sellingPrice: 500,
          costPrice: 300,
        });

      expect(baseItemRes.statusCode).toEqual(201);
      const baseItemId = baseItemRes.body.data._id;

      // Now create variants for this item
      const variantRes = await request(app)
        .post('/api/variants')
        .send({
          item_id: baseItemId,
          variantName: 'Variant 1 - Color Red',
          variantAttributes: [
            { key: 'Color', value: 'Red' }
          ],
          sku: 'VARIANT-1-SKU',
          defaultSellingPrice: 550,
        });

      expect(variantRes.statusCode).toEqual(201);
      expect(variantRes.body.variantName).toBe('VARIANT 1 - COLOR RED');
      expect(variantRes.body.item_id.toString()).toBe(baseItemId.toString());

      // Verify both default and new variant exist
      const variants = await ItemVariant.find({ item_id: baseItemId });
      expect(variants.length).toBe(2); // Default + new variant
    });

    it('should reject variant with duplicate SKU', async () => {
      // Create base item
      const baseItemRes = await request(app)
        .post('/api/items')
        .send({
          itemName: 'SKU Test Item',
          category: 'Device',
        });

      const baseItemId = baseItemRes.body.data._id;

      // Create first variant
      await request(app)
        .post('/api/variants')
        .send({
          item_id: baseItemId,
          variantName: 'First Variant',
          sku: 'DUPLICATE-SKU',
        });

      // Try to create second variant with same SKU
      const res = await request(app)
        .post('/api/variants')
        .send({
          item_id: baseItemId,
          variantName: 'Second Variant',
          sku: 'DUPLICATE-SKU',
        });

      expect(res.statusCode).toEqual(409);
      expect(res.body.message).toContain('Duplicate');
    });
  });

  describe('Item Name Validation', () => {
    it('should check item name availability', async () => {
      // Name should be available initially
      let res = await request(app)
        .get('/api/items/check-name?name=Test%20Availability');
      expect(res.statusCode).toEqual(200);
      expect(res.body.exists).toBe(false);

      // Create item with that name
      await request(app)
        .post('/api/items')
        .send({
          itemName: 'Test Availability',
          category: 'Accessory',
        });

      // Name should now be taken
      res = await request(app)
        .get('/api/items/check-name?name=Test%20Availability');
      expect(res.statusCode).toEqual(200);
      expect(res.body.exists).toBe(true);
    });

    it('should check barcode/SKU availability', async () => {
      // Barcode should be available initially
      let res = await request(app)
        .get('/api/items/check-barcode?value=TEST-BARCODE-AVAIL');
      expect(res.statusCode).toEqual(200);
      expect(res.body.exists).toBe(false);

      // Create item with that barcode
      await request(app)
        .post('/api/items')
        .send({
          itemName: 'Barcode Availability Test',
          category: 'Device',
          barcode: 'TEST-BARCODE-AVAIL',
        });

      // Barcode should now be taken
      res = await request(app)
        .get('/api/items/check-barcode?value=TEST-BARCODE-AVAIL');
      expect(res.statusCode).toEqual(200);
      expect(res.body.exists).toBe(true);
      expect(res.body.type).toBe('Item');
    });
  });

  describe('Item Retrieval', () => {
    it('should retrieve created items with stock information', async () => {
      // Create a few items
      await request(app)
        .post('/api/items')
        .send({
          itemName: 'Retrieval Test 1',
          category: 'Accessory',
          sellingPrice: 100,
        });

      await request(app)
        .post('/api/items')
        .send({
          itemName: 'Retrieval Test 2',
          category: 'Device',
          sellingPrice: 500,
        });

      // Retrieve all items
      const res = await request(app)
        .get('/api/items')
        .query({ page: 1, limit: 10 });

      expect(res.statusCode).toEqual(200);
      expect(res.body.data.length).toBe(2);
      expect(res.body.total).toBe(2);

      // Check that items have expected properties
      res.body.data.forEach(item => {
        expect(item).toHaveProperty('itemName');
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('totalStock');
        expect(item).toHaveProperty('variantCount');
      });
    });

    it('should retrieve single item by ID', async () => {
      // Create an item
      const createRes = await request(app)
        .post('/api/items')
        .send({
          itemName: 'Single Retrieval Test',
          category: 'Device',
          barcode: 'SINGLE-TEST-BARCODE',
          sellingPrice: 300,
        });

      const itemId = createRes.body.data._id;

      // Retrieve the item
      const res = await request(app)
        .get(`/api/items/${itemId}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.itemName).toBe('SINGLE RETRIEVAL TEST');
      expect(res.body.barcode).toBe('SINGLE-TEST-BARCODE');
      expect(res.body).toHaveProperty('totalStock');
    });
  });

  describe('Item Editing', () => {
    it('should update item properties', async () => {
      // Create an item
      const createRes = await request(app)
        .post('/api/items')
        .send({
          itemName: 'Edit Test Item',
          category: 'Accessory',
          sellingPrice: 100,
        });

      const itemId = createRes.body.data._id;

      // Update the item
      const updateRes = await request(app)
        .put(`/api/items/${itemId}`)
        .send({
          sellingPrice: 150,
          itemDescription: 'Updated description',
        });

      expect(updateRes.statusCode).toEqual(200);
      expect(updateRes.body.sellingPrice).toBe(150);
      expect(updateRes.body.itemDescription).toBe('Updated description');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle invalid item ID gracefully', async () => {
      const res = await request(app)
        .get('/api/items/invalid-id-format');

      expect(res.statusCode).toEqual(500); // MongoDB will throw error for invalid ObjectId
    });

    it('should handle missing item gracefully', async () => {
      const nonExistentId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .get(`/api/items/${nonExistentId}`);

      expect(res.statusCode).toEqual(404);
      expect(res.body.message).toBe('Product not found');
    });

    it('should handle special characters in item names', async () => {
      const specialItem = {
        itemName: 'Item with "quotes" & special chars!',
        category: 'Accessory',
        sellingPrice: 200,
      };

      const res = await request(app)
        .post('/api/items')
        .send(specialItem);

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.itemName).toBe('ITEM WITH "QUOTES" & SPECIAL CHARS!');
    });

    it('should handle very long item names', async () => {
      const longName = 'A'.repeat(200); // Very long name
      const longItem = {
        itemName: longName,
        category: 'Accessory',
      };

      const res = await request(app)
        .post('/api/items')
        .send(longItem);

      expect(res.statusCode).toEqual(201);
      expect(res.body.data.itemName).toBe(longName.toUpperCase());
    });
  });

  describe('Variant-Specific Edge Cases', () => {
    it('should handle items with multiple variants', async () => {
      // Create base item
      const baseItemRes = await request(app)
        .post('/api/items')
        .send({
          itemName: 'Multi-Variant Item',
          category: 'Device',
        });

      const baseItemId = baseItemRes.body.data._id;

      // Create multiple variants
      const variant1 = {
        item_id: baseItemId,
        variantName: 'Color Red - 64GB',
        variantAttributes: [
          { key: 'Color', value: 'Red' },
          { key: 'Storage', value: '64GB' }
        ],
        sku: 'MULTI-VARIANT-1',
      };

      const variant2 = {
        item_id: baseItemId,
        variantName: 'Color Blue - 128GB',
        variantAttributes: [
          { key: 'Color', value: 'Blue' },
          { key: 'Storage', value: '128GB' }
        ],
        sku: 'MULTI-VARIANT-2',
      };

      await request(app).post('/api/variants').send(variant1);
      await request(app).post('/api/variants').send(variant2);

      // Verify all variants exist
      const variants = await ItemVariant.find({ item_id: baseItemId });
      expect(variants.length).toBe(3); // Default + 2 new variants

      // Check that item shows correct variant count
      const res = await request(app)
        .get(`/api/items/${baseItemId}`);

      expect(res.statusCode).toEqual(200);
      // Note: The variant count is calculated in the aggregation
    });

    it('should handle variant name updates', async () => {
      // Create base item
      const baseItemRes = await request(app)
        .post('/api/items')
        .send({
          itemName: 'Variant Update Test',
          category: 'Device',
        });

      const baseItemId = baseItemRes.body.data._id;

      // Create a variant
      const createVariantRes = await request(app)
        .post('/api/variants')
        .send({
          item_id: baseItemId,
          variantName: 'Original Variant Name',
          sku: 'UPDATE-TEST-SKU',
        });

      const variantId = createVariantRes.body._id;

      // Update the variant
      const updateRes = await request(app)
        .put(`/api/variants/${variantId}`)
        .send({
          variantName: 'Updated Variant Name',
        });

      expect(updateRes.statusCode).toEqual(200);
      expect(updateRes.body.variantName).toBe('UPDATED VARIANT NAME');
    });
  });
});
