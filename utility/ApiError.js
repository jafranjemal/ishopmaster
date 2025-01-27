class ApiError extends Error {  
  constructor(statusCode, message) {
    super(message);
    
    // Add properties
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    
    // Maintain proper stack trace
    Error.captureStackTrace(this, this.constructor);
  }
 
}

// Export as named export
module.exports = { ApiError };