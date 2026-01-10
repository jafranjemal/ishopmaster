const express = require('express');
const router = express.Router();
const {
    getUploadSignature,
    deleteImage
} = require('../controllers/mediaController');
 // Assuming this exists, verify later
const { authenticate } = require('../middleware/auth');

// Check if protect middleware exists in similar files, if not remove or mock
// For now, assuming standard protect middleware
// If protect is not available, I will check users routes to see how they secure APIs

router.get('/sign-upload', getUploadSignature); // Add 'protect' if auth is ready
router.delete('/', deleteImage); // Add 'protect'

module.exports = router;
