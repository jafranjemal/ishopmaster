const Attribute = require('../models/Attribute');

const legacyData = {
    Color: ["Natural Titanium", "Desert Titanium", "Black", "White", "Blue", "Pink", "Yellow", "Green", "Red", "Silver", "Gold", "Space Gray", "Purple", "Midnight", "Starlight"],
    Storage: ["16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB", "2TB"],
    Region: ["USA (LL/A)", "Japan (J/A)", "Hong Kong (ZA/A)", "UAE (AE/A)", "UK (B/A)", "Global (ZP/A)", "India (HN/A)", "KSA", "Vietnam"],
    Condition: ["Brand New", "Open Box", "Like New", "Refurbished", "Used (Grade A)", "Used (Grade B)"],
    Network: ["Unlocked", "Carrier Locked", "5G", "4G/LTE"],
    Warranty: ["1 Year Apple", "1 Year Shop", "6 Months Shop", "No Warranty"],
    Length: ["0.25m", "0.5m", "1m", "1.2m", "1.5m", "2m", "3m"],
    Model: ["iPhone X", "iPhone XR", "iPhone 11", "iPhone 12", "iPhone 13", "iPhone 14", "iPhone 15", "iPhone 15 Pro", "iPhone 15 Pro Max"]
};

const attributeSeeder = async (connection) => {
    console.log('--- Seeding Attributes (Legacy Migration) ---');
    const AttributeModel = connection.model('Attribute', Attribute.schema);

    for (const key in legacyData) {
        const values = legacyData[key];
        const existing = await AttributeModel.findOne({ key: key.toUpperCase() });

        if (!existing) {
            await AttributeModel.create({
                key: key.toUpperCase(),
                values: values,
                description: `Industrial Standard ${key}`
            });
            console.log(`Attribute [${key}] created.`);
        } else {
            console.log(`Attribute [${key}] already exists. Skipping.`);
        }
    }
};

module.exports = { attributeSeeder };
