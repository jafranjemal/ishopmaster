require('dotenv').config();
const mongoose = require('mongoose');
const { seedRoles, seedUsers, seedPermissionsAndRoles } = require('./seeders/roleSeeder');

 const seedDatabase = async () => {
  try {
    // const localUri = 'mongodb://localhost:27017/ishopmaster'
    // await mongoose.connect(localUri);
    await seedPermissionsAndRoles();
    await seedUsers();
    console.log('Database seeded successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};





module.exports = {
    seedDatabase 
      
  };