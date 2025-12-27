const Customer = require('../models/Customer');
const Account = require('../models/Account');

/**
 * Seed the default "Walk-in Customer" for POS transactions
 * This customer is always available and has no credit (cash only)
 */
async function seedWalkInCustomer(connection) {
    const CustomerModel = connection.model('Customer');
    const AccountModel = connection.model('Account');

    try {
        // Check if walk-in customer already exists
        const existing = await CustomerModel.findOne({ customer_id: 'CUS-WALKIN' });
        if (existing) {
            console.log('Walk-in customer already exists, skipping seed');
            return;
        }

        // Create walk-in customer with fixed ID
        const walkInCustomer = new CustomerModel({
            customer_id: 'CUS-WALKIN',
            first_name: 'Walk-in',
            last_name: 'Customer',
            phone_number: '0000000000',
            email: 'walkin@store.local',
            address: 'In-store purchase',
            customer_type: 'Individual',
            creditLimit: 0, // Cash only - no credit allowed
        });

        await walkInCustomer.save();
        console.log('Walk-in customer created:', walkInCustomer.customer_id);

        // Create associated account for walk-in customer
        const walkInAccount = new AccountModel({
            account_name: 'Walk-in Customer Account',
            account_owner_type: 'Customer',
            related_party_id: walkInCustomer._id,
            balance: 0,
            account_type: 'Receivable',
        });

        await walkInAccount.save();
        console.log('Walk-in customer account created');

    } catch (error) {
        console.error('Error seeding walk-in customer:', error);
        throw error;
    }
}

module.exports = { seedWalkInCustomer };
