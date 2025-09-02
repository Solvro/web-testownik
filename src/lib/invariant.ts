const isProduction: boolean = process.env.NODE_ENV === "production";
const prefix = "Invariant failed";

export function invariant(
  condition: unknown,
  // Not providing an inline default argument for message as the result is smaller
  /**
   * Can provide a string, or a function that returns a string for cases where
   * the message takes a fair amount of effort to compute
   */
  message?: string | (() => string),
): asserts condition {
  // eslint-disable-next-line no-extra-boolean-cast
  if (Boolean(condition)) {
    return;
  }
  // Condition not passed

  // In production we strip the message but still throw
  if (isProduction) {
    throw new Error(prefix);
  }

  // When not in production we allow the message to pass through
  // *This block will be removed in production builds*

  const provided: string | undefined =
    typeof message === "function" ? message() : message;

  // Options:
  // 1. message provided: `${prefix}: ${provided}`
  // 2. message not provided: prefix
  const value: string =
    typeof provided === "string" ? `${prefix}: ${provided}` : prefix;
  throw new Error(value);
}
