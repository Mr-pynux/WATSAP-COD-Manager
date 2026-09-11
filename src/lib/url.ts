/**
 * Shared media-URL helpers (client + server safe — no window access).
 *
 * Goal: sellers paste links copied from WhatsApp / browsers / YouTube.
 * Those often lack the protocol or come as youtube share links —
 * we normalize instead of rejecting with "رابط غير صالح".
 */

/** Normalize a pasted media URL: trim, drop inner spaces, auto-prepend https://.
 *  Returns the clean URL string, or null when it can't be a URL at all. */
export function normalizeMediaUrl(raw: string): string | null {
  let url = (raw ?? "").trim().replace(/\s+/g, "");
  if (!url) return null;
  // allow "//host/path" shorthand
  if (url.startsWith("//")) url = `https:${url}`;
  // no protocol → assume https
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
  try {
    const u = new URL(url);
    // hostname must look like a domain (contains a dot)
    if (!u.hostname || !u.hostname.includes(".")) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Extract a YouTube video id from any link shape
 *  (watch?v=, youtu.be/, /shorts/, /embed/, /v/). Returns null when not YouTube. */
export function youtubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^(www|m|music)\./i, "");
    if (host === "youtu.be") {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const m = u.pathname.match(/\/(embed|shorts|v|live)\/([\w-]{6,})/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

/** YouTube privacy-friendly embed URL (with loop params) for a video id. */
export function youtubeEmbed(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&loop=1&playlist=${id}&rel=0&playsinline=1`;
}
