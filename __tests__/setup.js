const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

const setup = async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  console.log('!!! JEST SETUP: Connecting to in-memory database:', mongoUri);
  await mongoose.connect(mongoUri);
};

const teardown = async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
};

module.exports = { setup, teardown };
