class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: string;
  public readonly isOperational: boolean;
  public readonly errors: any; // Holds deep validation objects safely without corrupting the main message string

  constructor(
    statusCode: number,
    message: string | object,
    isOperational = true,
    stack = "",
  ) {
    let finalMessage = "An unexpected error occurred.";
    let secondaryErrors: any = null;

    // Handle structural objects cleanly without turning the primary message into raw JSON code
    if (typeof message === "object" && message !== null) {
      secondaryErrors = message;
      // If the object has a message property, extract it; otherwise, provide a fallback hint
      finalMessage =
        (message as any).message ||
        "Validation or processing layout constraints failed.";
    } else if (typeof message === "string") {
      finalMessage = message;
    }

    super(finalMessage);

    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = secondaryErrors;

    // Auto-calculate structural status categories for frontend filtering
    this.status = `${statusCode}`.startsWith("4") ? "fail" : "error";

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export default AppError;
