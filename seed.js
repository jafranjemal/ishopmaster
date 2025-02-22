require('dotenv').config();
const mongoose = require('mongoose');
const { seedRoles, seedUsers, seedPermissionsAndRoles, seedDefaultCompany } = require('./seeders/roleSeeder');
const { issuesSeeder } = require('./seeders/issuesSeeder');
const MONGO_URI = process.env.NODE_ENV === 'production' ? process.env.PROD_URI : process.env.LOCAL_URI;

 const seedDatabase = async () => {
  try {
    // const localUri = 'mongodb://localhost:27017/ishopmaster'
    
    const mainConnection = await mongoose.createConnection(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });


    await seedDefaultCompany(mainConnection);
    await seedPermissionsAndRoles(mainConnection);
    await seedUsers(mainConnection);
    await issuesSeeder(mainConnection);
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