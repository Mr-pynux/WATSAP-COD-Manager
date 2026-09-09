import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { requireAdmin, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");
const MAX_BYTES = 6 * 1024 * 1024; // 6 MB
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

/**
 * POST /api/admin/upload — upload a product image (multipart form, field "file").
 * Files are stored outside /public and served via /api/media/<name> so they work
 * immediately in dev without a server restart.
 */
export async function POST(req: Request) {
  if (!(await requireAdmin())) return unauthorized();

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "الملف مختارش" }, { status: 400 });
  }

  const ext = ALLOWED[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "الصيغة مدعومةش — استعمل JPG / PNG / WEBP / AVIF / GIF" },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "الصورة كبيرة — الحد 6 ميغا" }, { status: 400 });
  }

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const name = `${randomUUID()}.${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(UPLOAD_DIR, name), bytes);
    return NextResponse.json({ url: `/api/media/${name}` }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "فشل رفع الصورة" }, { status: 500 });
  }
}
