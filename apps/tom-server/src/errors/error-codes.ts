export const ERROR_CODES = [
  "M_INVALID_PARAM",
  "M_UNAUTHORIZED",
  "M_FORBIDDEN",
  "M_NOT_FOUND",
  "M_TERMS_NOT_SIGNED",
  "M_INVALID_PEPPER",
  "M_UNKNOWN",
  "M_SERVICE_UNAVAILABLE",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

// Named constants for readability at usage sites
export const INVALID_INPUT: ErrorCode = "M_INVALID_PARAM";
export const UNAUTHORIZED: ErrorCode = "M_UNAUTHORIZED";
export const FORBIDDEN: ErrorCode = "M_FORBIDDEN";
export const NOT_FOUND: ErrorCode = "M_NOT_FOUND";
export const TERMS_NOT_SIGNED: ErrorCode = "M_TERMS_NOT_SIGNED";
export const INVALID_PEPPER: ErrorCode = "M_INVALID_PEPPER";
export const INTERNAL: ErrorCode = "M_UNKNOWN";
export const SERVICE_UNAVAILABLE: ErrorCode = "M_SERVICE_UNAVAILABLE";
