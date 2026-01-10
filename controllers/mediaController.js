const cloudinary = require('cloudinary').v2;
const Company = require('../models/Company');
const asyncHandler = require('express-async-handler');

// @desc    Get Cloudinary Signature for Upload
// @route   GET /api/media/sign-upload
// @access  Private
const getUploadSignature = asyncHandler(async (req, res) => {
    // 1. Get Company Config (Assuming user is attached to request via auth middleware)
    // For single tenant or simple auth, we might just fetch the first company or specific ID.
    // Assuming req.user exists. If not, we block.
    // For MVP/This system: We'll fetch the FIRST company found (Single Tenant Logic) or user's company.

    // Fallback: Fetch the first company if no ID provided (common in single-tenant apps)
    const company = await Company.findOne();

    if (!company) {
        res.status(404);
        throw new Error('Company configuration not found');
    }

    if (!company.cloudinary_api_key || !company.cloudinary_api_secret || !company.cloudinary_cloud_name) {
        res.status(400);
        throw new Error('Cloudinary not configured for this company');
    }

    // 2. Configure Cloudinary (Server-side only)
    cloudinary.config({
        cloud_name: company.cloudinary_cloud_name,
        api_key: company.cloudinary_api_key,
        api_secret: company.cloudinary_api_secret,
    });

    // 3. Generate Timestamp
    const timestamp = Math.round((new Date()).getTime() / 1000);

    // 4. Generate Signature
    // We sign the timestamp and upload_preset (if used)
    const params = {
        timestamp: timestamp,
        folder: company.cloudinary_folder || 'shop-erp',
    };

    if (company.cloudinary_upload_preset) {
        params.upload_preset = company.cloudinary_upload_preset;
    }

    const signature = cloudinary.utils.api_sign_request(params, company.cloudinary_api_secret);

    res.json({
        signature,
        timestamp,
        cloudName: company.cloudinary_cloud_name,
        apiKey: company.cloudinary_api_key,
        folder: params.folder,
        uploadPreset: company.cloudinary_upload_preset
    });
});

// @desc    Delete Image from Cloudinary
// @route   DELETE /api/media
// @access  Private
const deleteImage = asyncHandler(async (req, res) => {
    const { publicId } = req.body;

    if (!publicId) {
        res.status(400);
        throw new Error('Public ID is required');
    }

    const company = await Company.findOne(); // Adjust for multi-tenant if needed

    if (!company || !company.cloudinary_api_key) {
        res.status(404);
        throw new Error('Company/Cloudinary config not found');
    }

    cloudinary.config({
        cloud_name: company.cloudinary_cloud_name,
        api_key: company.cloudinary_api_key,
        api_secret: company.cloudinary_api_secret,
    });

    try {
        const result = await cloudinary.uploader.destroy(publicId);
        res.json({ message: 'Image deleted', result });
    } catch (error) {
        res.status(500);
        throw new Error('Cloudinary deletion failed: ' + error.message);
    }
});

module.exports = {
    getUploadSignature,
    deleteImage
};
