import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** DELETE /api/blacklist/[id] — remove entry by its database id. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await requireAdmin())) return unauthorized();

  const { id } = await params;
  try {
    await db.blacklistEntry.delete({ where: { id } });
  } catch {
    return NextResponse.json({ error: "القيد غير موجود" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
