export const validationError = (field, message) => ({
  statusCode: 400,
  body: {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message,
      field,
    },
  },
});

export const notFoundError = (field, message) => ({
  statusCode: 404,
  body: {
    success: false,
    error: {
      code: "NOT_FOUND",
      message,
      field,
    },
  },
});

export const serverError = (message = "Internal server error") => ({
  statusCode: 500,
  body: {
    success: false,
    error: {
      code: "SERVER_ERROR",
      message,
    },
  },
});
