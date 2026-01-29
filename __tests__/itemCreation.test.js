const request = require('supertest');
const { app, server } = require('../server');
const { setup, teardown } = require('./setup');
const Item = require('../models/Items');
const ItemVariant = require('../models/ItemVariantSchema');

describe('Item Creation API', () => {
  console.log('!!! JEST TEST: Mongoose connection host:', mongoose.connection.host);
  console.log('!!! JEST TEST: Mongoose connection name:', mongoose.connection.name);

  beforeAll(async () => {
    await setup();
  });

  afterAll(async () => {
    await teardown();
    server.close();
  });

  // afterEach(async () => {
  //   await Item.deleteMany({});
  //   await ItemVariant.deleteMany({});
  // });

  it('should create an item and a default variant successfully', async () => {
    const newItem = {
      itemName: 'Test Item',
      category: 'Accessory',
      unit: 'pcs',
      sellingPrice: 100,
      costPrice: 50,
      stock: 10,
    };

    const res = await request(app)
      .post('/api/items')
      .send(newItem);

    expect(res.statusCode).toEqual(201);
    expect(res.body.message).toBe('Product created successfully');
    expect(res.body.data).toHaveProperty('_id');
    expect(res.body.data.itemName).toBe('TEST ITEM');

    const createdItem = await Item.findById(res.body.data._id);
    expect(createdItem).not.toBeNull();
    expect(createdItem.itemName).toBe('TEST ITEM');

    const defaultVariant = await ItemVariant.findOne({ item_id: createdItem._id });
    expect(defaultVariant).not.toBeNull();
    expect(defaultVariant.variantName).toBe('DEFAULT');
  });
});
