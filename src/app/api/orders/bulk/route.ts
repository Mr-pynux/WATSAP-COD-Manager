import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin, unauthorized } from "@/lib/auth";
import { changeOrderStatus } from "@/lib/orders-service";
import { ORDER_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

const bulkSchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
  status: z.string().refine((s) =>
    ORDER_STATUSES.includes(s as (typeof ORDER_STATUSES)[number])
  ),
});

export async function POST(req: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const parsed = bulkSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
  }
  const { ids, status } = parsed.data;

  let changed = 0;
  for (const id of ids) {
    const result = await changeOrderStatus(id, status);
    if (result) changed++;
  }

  return NextResponse.json({ changed });
}
