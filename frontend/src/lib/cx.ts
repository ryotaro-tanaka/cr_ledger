export function cx(...xs: Array<string | false | undefined | null>) {
  return xs.filter(Boolean).join(" ");
}
