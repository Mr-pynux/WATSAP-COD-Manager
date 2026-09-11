import type { OrderStatus } from "./constants";
import { waLink } from "./phone";

export interface TemplateVars {
  name?: string;
  product?: string;
  size?: string;
  color?: string;
  quantity?: number;
  total?: string;
  city?: string;
  tracking?: string;
}

interface OrderLike {
  status: string;
  attempts: number;
  shipDate?: Date | string | null;
}

/** Replace {var} placeholders in a template body. */
export function render(body: string, vars: TemplateVars): string {
  const map: Record<string, string> = {
    name: vars.name ?? "",
    product: vars.product ?? "",
    size: vars.size ?? "",
    color: vars.color ?? "",
    quantity: vars.quantity != null ? String(vars.quantity) : "",
    total: vars.total ?? "",
    city: vars.city ?? "",
    tracking: vars.tracking ?? "",
  };
  return body.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in map ? map[key] : match
  );
}

/** Total (MAD) as an integer string for messages (after offer discount). */
export function formatTotal(
  quantity: number,
  unitPriceMad: number,
  discountMad?: number | null
): string {
  const total = Math.max(0, Math.round(quantity * unitPriceMad - (discountMad ?? 0)));
  return String(total);
}

/** is "tomorrow" relative to today (ignoring time-of-day, local server time). */
function isTomorrow(date: Date): boolean {
  const d = new Date(date);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return (
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate()
  );
}

/**
 * Business rule for which template to use for a given order:
 * - new & attempts=0        → confirm_1
 * - (no_answer|retry) & attempts=1 → followup_2
 * - attempts >= 2           → followup_3
 * - confirmed & shipDate tomorrow → day_before
 * - shipped                 → shipped
 */
export function pickTemplateKey(order: OrderLike): string {
  const status = order.status as OrderStatus;
  if (status === "new" && order.attempts === 0) return "confirm_1";
  if (status === "shipped") return "shipped";
  if (status === "confirmed") {
    if (order.shipDate && isTomorrow(new Date(order.shipDate))) return "day_before";
    return "day_before";
  }
  if ((status === "no_answer" || status === "retry") && order.attempts === 1)
    return "followup_2";
  if (order.attempts >= 2) return "followup_3";
  return "followup_2";
}

/** Full WhatsApp URL for an order + template body. */
export function buildOrderWaUrl(
  phone: string,
  templateBody: string,
  vars: TemplateVars
): string {
  return waLink(phone, render(templateBody, vars));
}
