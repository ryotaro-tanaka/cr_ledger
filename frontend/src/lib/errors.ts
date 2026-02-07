import { ApiError, AuthError } from "../api/api";

/**
 * Convert unknown error into a user-friendly plain text.
 * - AuthError: shows message
 * - ApiError: shows status + bodyText
 * - Error: shows message
 * - unknown: fallback text
 */
export function toErrorText(e: unknown): string {
  if (e instanceof AuthError) return e.message;

  if (e instanceof ApiError) {
    // e.bodyText already contains server response body text
    const status = typeof e.status === "number" ? e.status : undefined;
    return `${status ?? "API Error"}\n${e.bodyText ?? ""}`.trim();
  }

  if (e instanceof Error) return e.message;

  try {
    return JSON.stringify(e);
  } catch {
    return "Unknown error";
  }
}
