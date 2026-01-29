const Account = require("../models/Account");

/**
 * Resolves a payment method name to a target Account ID.
 * Returns a fallback Company Cash account if no specific mapping exists.
 * 
 * @param {string} methodName - The name of the payment method (e.g., "Visa", "Cash")
 * @returns {Promise<string>} - The ObjectId of the target Account
 */
exports.resolveAccountForMethod = async (methodName) => {
    try {
        // Fallback Logic:
        // 1. If it's "Cash", find the Company account of type "Cash"
        // 2. Otherwise, find the Company account matching the methodName type (if applicable)
        // 3. Absolute fallback: Find ANY Company account

        let targetAccount = null;

        if (methodName?.toLowerCase() === "cash") {
            targetAccount = await Account.findOne({
                account_owner_type: "Company",
                account_type: "Cash"
            });
        }

        // If no specific account found, or not cash, try to find ANY company account
        if (!targetAccount) {
            targetAccount = await Account.findOne({ account_owner_type: "Company" });
        }

        if (!targetAccount) {
            throw new Error("Critical: No Company Account found for payment resolution.");
        }

        return targetAccount._id;

    } catch (error) {
        console.error(`Error resolving account for method ${methodName}:`, error);
        throw error;
    }
};
