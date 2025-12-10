const { ApiError } = require('../utility/ApiError');

const errorHandler = (err, req, res, next) => {
  console.error("🔥 ERROR:", err);

  // ApiError (custom application errors)
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.status,
      message: err.message,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    });
  }

  // 🔥 Mongoose Validation Errors
  if (err.name === "ValidationError") {
    const formattedErrors = [];

    for (const field in err.errors) {
      const e = err.errors[field];

      formattedErrors.push({
        field: e.path,
        message: e.message,
        kind: e.kind,
        value: e.value,
      });
    }

    const readableMessage = formattedErrors
      .map(e => `${e.field}: ${e.message}`)
      .join("; ");

    return res.status(400).json({
      success: false,
      status: "validation_error",
      message: readableMessage,
      details: formattedErrors,
      ...(process.env.NODE_ENV === "development" && { stack: err.stack })
    });
  }

  // 🔥 Wrong ObjectId / wrong type
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      status: "invalid_type",
      message: `Invalid value for '${err.path}': ${err.value}`,
    });
  }

  // 🔥 Duplicate Key Error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    return res.status(400).json({
      success: false,
      status: "duplicate_error",
      message: `Duplicate value for field '${field}': ${err.keyValue[field]}`
    });
  }

  // 🔥 Default Fallback Error
  return res.status(500).json({
    success: false,
    status: "server_error",
    message:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Internal Server Error",
    ...(process.env.NODE_ENV === "development" && {
      stack: err.stack,
      fullError: err
    })
  });
};

module.exports = errorHandler;
