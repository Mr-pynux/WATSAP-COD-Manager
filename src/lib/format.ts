import { format } from "date-fns";

/** All user-facing dates: dd/MM/yyyy */
export function fmtDate(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd/MM/yyyy");
}

export function fmtDateTime(date: Date | string | null | undefined): string {
  if (!date) return "—";
  return format(new Date(date), "dd/MM/yyyy HH:mm");
}

/** MAD money formatting: integers mostly. */
export function fmtMad(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  return `${Math.round(amount * 100) / 100} درهم`;
}

export function fmtPercent(rate: number | null | undefined): string {
  if (rate == null || Number.isNaN(rate)) return "—";
  return `${Math.round(rate * 100)}%`;
}

/** yyyy-MM-dd for <input type="date"> */
export function toDateInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  return format(new Date(date), "yyyy-MM-dd");
}
