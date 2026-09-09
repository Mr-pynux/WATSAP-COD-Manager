import { format } from "date-fns";

export interface CsvRow {
  orderNumber: number;
  customerName: string;
  phone: string;
  city: string;
  district?: string | null;
  landmark?: string | null;
  productName: string;
  size: string;
  color?: string | null;
  quantity: number;
  totalMad: number;
  notes?: string | null;
  statusLabel: string;
  createdAt: Date;
}

function esc(value: string): string {
  const v = value.replace(/\r?\n/g, " ").trim();
  if (/[",;]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

/**
 * CSV for couriers: UTF-8 BOM + CRLF line endings (Excel-friendly Arabic).
 * Columns: رقم الطلب، الاسم، الهاتف، المدينة، الحي/نقطة دالة، المنتج (مقاس/لون)، الكمية، المبلغ (درهم)، ملاحظات
 */
export function buildOrdersCsv(rows: CsvRow[]): string {
  const header = [
    "رقم الطلب",
    "الاسم",
    "الهاتف",
    "المدينة",
    "الحي/نقطة دالة",
    "المنتج (مقاس/لون)",
    "الكمية",
    "المبلغ (درهم)",
    "ملاحظات",
  ].map(esc);

  const lines = [header.join(",")];

  for (const r of rows) {
    const area = [r.district, r.landmark].filter(Boolean).join(" — ");
    const product = `${r.productName} (${r.size}${r.color ? "/" + r.color : ""})`;
    const noteParts: string[] = [];
    if (r.notes) noteParts.push(r.notes);
    noteParts.push(`الحالة: ${r.statusLabel}`);
    lines.push(
      [
        esc(`ORD-${r.orderNumber}`),
        esc(r.customerName),
        esc(r.phone),
        esc(r.city),
        esc(area),
        esc(product),
        esc(String(r.quantity)),
        esc(String(Math.round(r.totalMad))),
        esc(noteParts.join(" | ")),
      ].join(",")
    );
  }

  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

export function csvFilename(): string {
  return `orders-${format(new Date(), "yyyy-MM-dd")}.csv`;
}
