export class PublicApiError extends Error {
  constructor(code, message, status = 500, details = undefined) {
    super(message);
    this.name = "PublicApiError";
    this.code = code;
    this.publicMessage = message;
    this.status = status;
    this.details = details;
  }
}

export function toPublicError(error) {
  if (error instanceof PublicApiError) {
    return {
      code: error.code,
      message: error.publicMessage,
      status: error.status,
      details: error.details,
    };
  }

  return {
    code: error?.code || "unexpected_error",
    message: "Unexpected API failure.",
    status: 500,
  };
}
