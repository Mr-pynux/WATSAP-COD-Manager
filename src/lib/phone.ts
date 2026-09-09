export const MA_PHONE_REGEX = /^0(6|7)[0-9]{8}$/;

/** Client-side validation (raw input, digits only are also fine). */
export function isValidMaPhone(raw: string): boolean {
  return MA_PHONE_REGEX.test(raw);
}

/**
 * Server-side normalization:
 * - strip non-digits
 * - 212XXXXXXXXXX (12 digits) → 0XXXXXXXXXX
 * - 00212... handled by the same 212 prefix strip after leading 00 removal
 * Returns null when the normalized value does not match the Moroccan mobile regex.
 */
export function normalizeMaPhone(raw: string): string | null {
  let digits = (raw || "").replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("212")) {
    const rest = digits.slice(3);
    digits = "0" + rest;
  }
  if (!MA_PHONE_REGEX.test(digits)) return null;
  return digits;
}

/** Builds the wa.me deep link for a normalized Moroccan phone (06/07...). */
export function waLink(phone: string, message: string): string {
  return `https://wa.me/212${phone.slice(1)}?text=${encodeURIComponent(message)}`;
}
