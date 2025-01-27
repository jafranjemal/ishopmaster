const INVOICE_STATUS = {
    REVERSED: 'Reversed',
    SALE: 'Sale'
  };
  
  const MESSAGES = {
    NOT_FOUND: 'Invoice not found',
    ALREADY_REVERSED: 'Invoice already reversed, cannot modify again',
    REVERSED_SUCCESS: 'Invoice reversed and re-entered successfully',
    UPDATE_SUCCESS: 'Invoice updated successfully',
    RETURN_SUCCESS: 'Invoice returned successfully'
  };
  
  module.exports = {
    INVOICE_STATUS,
    MESSAGES
  };