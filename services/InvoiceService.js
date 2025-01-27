const { SalesInvoice } = require('../models/SalesInvoice');
const ApiError  = require('../utility/ApiError');
const { INVOICE_STATUS, MESSAGES } = require('../constants');

class InvoiceService {
  async updateInvoice(invoiceId, updates, transaction_type, context) {
    const existingInvoice = await this.validateAndGetInvoice(invoiceId);
    
    if (this.hasDuePaymentChange(existingInvoice, updates)) {
      return this.handleDuePayment(existingInvoice, updates);
    }

    return transaction_type === INVOICE_STATUS.SALE 
      ? this.handleSaleUpdate(existingInvoice, updates, context)
      : this.handleReturn(existingInvoice, transaction_type);
  }

  async validateAndGetInvoice(invoiceId) {
    const invoice = await SalesInvoice.findById(invoiceId).populate("items.item_id");
    if (!invoice) {
      throw new ApiError(404, MESSAGES.NOT_FOUND);
    }
    if (invoice.status === INVOICE_STATUS.REVERSED) {
      throw new ApiError(400, MESSAGES.ALREADY_REVERSED);
    }
    return invoice;
  }

  hasDuePaymentChange(existingInvoice, updates) {
    const oldDue = existingInvoice.total_amount - existingInvoice.total_paid_amount;
    const updatedDue = updates.total_amount - updates.total_paid_amount;
    return oldDue > updatedDue;
  }

  async handleDuePayment(existingInvoice, updates) {
    const result = await settleDuePayment(existingInvoice, updates);
    return { message: MESSAGES.UPDATE_SUCCESS, result };
  }

  async handleSaleUpdate(existingInvoice, updates, context) {
    const { customer, items, payment_methods, user_id, shift_id } = context;
    const hasCustomerChange = updates.customer && updates.customer.toString() !== existingInvoice.customer.customer_id.toString();
    const hasItemChanges = updates.items && JSON.stringify(updates.items) !== JSON.stringify(existingInvoice.items);

    if (hasCustomerChange || hasItemChanges) {
      await reverseSalesInvoice(existingInvoice._id, "Updating Sales");
      const newInvoice = await createReversalSalesInvoice(customer, items, payment_methods, INVOICE_STATUS.SALE, user_id, shift_id);
      return { message: MESSAGES.REVERSED_SUCCESS, invoice: newInvoice };
    }

    Object.assign(existingInvoice, updates);
    await existingInvoice.save();
    return { message: MESSAGES.UPDATE_SUCCESS, invoice: existingInvoice };
  }

  async handleReturn(existingInvoice, transaction_type) {
    await reverseSalesInvoice(existingInvoice._id, `${transaction_type} Sales`);
    return { message: MESSAGES.RETURN_SUCCESS, invoice: existingInvoice };
  }
}

module.exports = { InvoiceService };