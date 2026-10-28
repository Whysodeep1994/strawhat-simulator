/**
 * Gets your playmat and card backs ready to send to a friend online (see Looks in online.ts).
 * Ready-made ones go by name. An uploaded picture is shrunk first, because it travels a small
 * piece at a time and a smaller picture reaches your friend sooner.
 */
import type { BackChoice } from "./card-backs.js";
import { isUpload } from "./playmat.js";
import { DEFAULT_LOOKS, safeLook, type Looks } from "./online.js";

/** The largest pictures sent, in characters: roughly 60 KB for a mat and 12 KB for a card back. */
const MAT = { width: 1000, chars: 80_000 };
const BACK = { width: 240, chars: 16_000 };

export async function looksToShare(mat: string | null, back: BackChoice): Promise<Looks> {
  const [sharedMat, sharedBack] = await Promise.all([
    isUpload(mat) ? shrink(mat as string, MAT) : mat,
    back.startsWith("data:") ? shrink(back, BACK) : back,
  ]);
  return {
    mat: sharedMat !== null && safeLook(sharedMat) ? sharedMat : null,
    back: safeLook(sharedBack) ? sharedBack : DEFAULT_LOOKS.back,
  };
}

/** A smaller JPEG of a picture, trying lower quality and then a smaller size until it fits. */
async function shrink(
  picture: string,
  limit: { width: number; chars: number },
): Promise<string | null> {
  if (picture.length <= limit.chars && picture.startsWith("data:image/jpeg")) return picture;
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = picture;
    });
    let width = Math.min(limit.width, image.naturalWidth);
    for (let tries = 0; tries < 6; tries++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(width));
      canvas.height = Math.max(1, Math.round((width * image.naturalHeight) / image.naturalWidth));
      canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.65, 0.5]) {
        const out = canvas.toDataURL("image/jpeg", quality);
        if (out.length <= limit.chars) return out;
      }
      width *= 0.75;
    }
  } catch {
    // A picture that won't open isn't sent; your friend sees the default instead.
  }
  return null;
}
