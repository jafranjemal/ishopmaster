const CustomerDevice = require("../models/CustomerDevice");
const { ApiError } = require("../utility/ApiError");

/**
 * Validates warranty status by IMEI/Serial Number
 * Logic:
 * - Full Swap: today <= replacementUntil
 * - Service Only: replacementUntil < today <= serviceUntil
 * - Expired: today > serviceUntil
 */
exports.checkWarrantyByIMEI = async (req, res) => {
    const { serialNumber } = req.params;

    if (!serialNumber) {
        throw new ApiError(400, "Serial Number is required");
    }

    const device = await CustomerDevice.findOne({ serialNumber })
        .populate("owner", "first_name last_name phone_number")
        .populate("itemId", "itemName")
        .populate("variantId", "variantName");

    if (!device) {
        return res.status(404).json({
            success: false,
            message: "Device not found in registry.",
            serialNumber
        });
    }

    const now = new Date();
    const warranty = device.warranty || {};

    let status = "NO WARRANTY";
    let color = "secondary";

    if (warranty.replacementUntil && now <= new Date(warranty.replacementUntil)) {
        status = "FULL SWAP (Replacement)";
        color = "success";
    } else if (warranty.serviceUntil && now <= new Date(warranty.serviceUntil)) {
        status = "SERVICE ONLY (Maintenance)";
        color = "warning";
    } else if (warranty.serviceUntil) {
        status = "EXPIRED";
        color = "danger";
    }

    res.status(200).json({
        success: true,
        device: {
            name: device.deviceName || device.itemId?.itemName,
            serialNumber: device.serialNumber,
            owner: device.owner ? `${device.owner.first_name} ${device.owner.last_name || ""}` : "Walk-in Customer",
            purchaseDate: warranty.purchaseDate,
        },
        warranty: {
            status,
            color,
            policyName: warranty.policyName,
            replacementUntil: warranty.replacementUntil,
            serviceUntil: warranty.serviceUntil,
            terms: warranty.termsApplied
        }
    });
};
