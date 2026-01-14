import { ApiError, AuthError } from "../api/api";

export function toErrorText(e: unknown): string {
  if (e instanceof AuthError) return e.message;
  if (e instanceof ApiError) return `${e.status}\n${e.bodyText || "(empty body)"}`;
  if (e instanceof Error) return e.message;
  return "Unknown error";
}
