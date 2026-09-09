import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  mp4: "video/mp4",
};

/**
 * GET /api/media/[name] — serve an uploaded media file (admin product images).
 * The name is strictly validated to prevent path traversal.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(name)) {
    return NextResponse.json({ error: "اسم ملف غير صالح" }, { status: 400 });
  }

  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const type = CONTENT_TYPES[ext];
  if (!type) {
    return NextResponse.json({ error: "صيغة غير مدعومة" }, { status: 400 });
  }

  try {
    const buffer = await readFile(path.join(UPLOAD_DIR, name));
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "الملف غير موجود" }, { status: 404 });
  }
}
