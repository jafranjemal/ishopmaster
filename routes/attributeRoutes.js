const express = require('express');
const router = express.Router();
const attributeController = require('../controllers/attributeController');

router.get('/', attributeController.getAttributes);
router.post('/', attributeController.saveAttribute);
router.post('/quick-sync', attributeController.quickSync);
router.delete('/:id', attributeController.deleteAttribute);
router.put('/reorder', attributeController.reorderAttributes);
// Manual trigger for legacy migration/seeding
router.get('/bootstrap', async (req, res) => {
    try {
        const legacyData = {
            Color: ["Natural Titanium", "Desert Titanium", "Black", "White", "Blue", "Pink", "Yellow", "Green", "Red", "Silver", "Gold", "Space Gray", "Purple", "Midnight", "Starlight", "Pacific Blue", "Sierra Blue", "Alpine Green", "Deep Purple"],
            Storage: ["16GB", "32GB", "64GB", "128GB", "256GB", "512GB", "1TB", "2TB"],
            Region: ["USA (LL/A)", "Japan (J/A)", "Hong Kong (ZA/A)", "UAE (AE/A)", "UK (B/A)", "Global (ZP/A)", "India (HN/A)", "KSA", "Vietnam", "Canada", "Singapore"],
            Condition: ["Brand New", "Open Box", "Like New", "Certified Refurbished", "Used (Grade A+)", "Used (Grade A)", "Used (Grade B)", "Used (Grade C)", "Faulty/Parts Only"],
            Battery_Health: ["100%", "95-99%", "90-94%", "85-89%", "80-84%", "Below 80% (Service Required)"],
            RAM: ["4GB", "6GB", "8GB", "12GB", "16GB"],
            Processor: ["A14 Bionic", "A15 Bionic", "A16 Bionic", "A17 Pro", "A18", "A18 Pro", "M1", "M2"],
            Network: ["Unlocked", "Verizon", "AT&T", "T-Mobile", "Softbank", "Docomo", "Global Dual SIM"],
            Warranty_Type: ["AppleCare+", "Limited Apple Warranty", "Shop Warranty", "Exchange Only", "No Warranty"],
            Part_Quality: ["Original (Genuine)", "High Copy (Premium)", "China Copy (Standard)", "OEM/Aftermarket", "Certified Refurbished"],
            Display_Quality: ["Original (Pull)", "Original (Refurbished)", "Premium OLED (Soft)", "Premium OLED (Hard)", "Incell Screen", "TFT/LCD Copy"],
            FaceID_TouchID: ["Functional (Working)", "Non-Functional (Bad)", "Bypassed", "Broken/Cracked Sensor"],
            Housing_Grade: ["A+ (Pristine/New)", "A (Minor Scratches)", "B (Light Dents/Wear)", "C (Heavy Dents/Cracks)", "D (Parts Only)"],
            Model_Series: ["iPhone 16 Series", "iPhone 15 Series", "iPhone 14 Series", "iPhone 13 Series", "iPhone 12 Series", "iPhone 11 Series", "iPhone SE Series", "iPad Pro Series", "Apple Watch Series"]
        };
        const results = await attributeController.bootstrapAttributes(legacyData);
        res.status(200).json({ message: "Bootstrap successful", results });
    } catch (error) {
        res.status(500).json({ message: "Bootstrap failed", error: error.message });
    }
});

module.exports = router;
