export class AppError extends Error {
  constructor({
    message,
    code = "APP_ERROR",
    status = 500,
    details = null,
    hint = null,
    cause = null,
    userMessage = "",
  }) {
    super(message || userMessage || "Erro inesperado.");
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.details = details;
    this.hint = hint;
    this.cause = cause;
    this.userMessage = userMessage || "";
  }
}

export function normalizeError(error, fallbackMessage = "Erro inesperado.") {
  if (error instanceof AppError) {
    return error;
  }

  if (typeof error === "string") {
    return new AppError({ message: error, userMessage: error });
  }

  if (error?.message) {
    return new AppError({
      message: error.message,
      code: error.code || error.status || "APP_ERROR",
      status: error.status || 500,
      details: error.details || null,
      hint: error.hint || null,
      cause: error,
      userMessage: error.userMessage || error.message,
    });
  }

  return new AppError({ message: fallbackMessage, userMessage: fallbackMessage, cause: error });
}

export function getUserFacingErrorMessage(error, fallbackMessage = "Erro inesperado.") {
  const normalized = normalizeError(error, fallbackMessage);
  return normalized.userMessage || normalized.message || fallbackMessage;
}

export function hasColumnMissingError(error, columnName) {
  const message = String(error?.message || "");
  return message.includes(columnName) && message.includes("column");
}
