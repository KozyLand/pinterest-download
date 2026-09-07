import type { PinterestImageVariant } from "../types.js";

/**
 * Pinterest renvoie plusieurs tailles par pin (ex: "150x150", "400x300", "600x",
 * "1200x", "originals"). On prend la plus grande largeur disponible, avec une
 * préférence explicite pour la clé "originals" quand elle existe.
 */
export function pickBestImage(
  images: Record<string, PinterestImageVariant> | undefined
): PinterestImageVariant | null {
  if (!images) return null;

  if (images.originals) return images.originals;

  let best: PinterestImageVariant | null = null;
  for (const variant of Object.values(images)) {
    if (!best || variant.width > best.width) {
      best = variant;
    }
  }
  return best;
}

export function extensionFromUrl(url: string): string {
  const clean = url.split("?")[0];
  const match = /\.([a-zA-Z0-9]{2,5})$/.exec(clean);
  const ext = match?.[1]?.toLowerCase();
  if (ext && ["jpg", "jpeg", "png", "gif", "webp"].includes(ext)) {
    return ext === "jpeg" ? "jpg" : ext;
  }
  return "jpg";
}
