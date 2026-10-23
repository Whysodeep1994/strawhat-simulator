/**
 * Playmat images people upload. They stay in this browser only (localStorage); in online play
 * each player's mat will travel with their seat.
 */
export type MatSeat = "you" | "opponent";

const key = (seat: MatSeat) => `strawhat.playmat.${seat}`;

export function loadMat(seat: MatSeat): string | null {
  try {
    return localStorage.getItem(key(seat));
  } catch {
    return null;
  }
}

/** Returns false when the browser refused to store it (private mode or out of space). */
export function saveMat(seat: MatSeat, image: string | null): boolean {
  try {
    if (image) localStorage.setItem(key(seat), image);
    else localStorage.removeItem(key(seat));
    return true;
  } catch {
    return false;
  }
}

/** Reads an uploaded picture and shrinks it to a playmat-sized JPEG, so it stores quickly. */
export async function readMatImage(file: File, maxWidth = 1600): Promise<string> {
  if (!file.type.startsWith("image/"))
    throw new Error("Please choose an image file (JPG, PNG, or WebP).");
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("That image couldn't be opened. Try a JPG or PNG."));
      img.src = url;
    });
    const scale = Math.min(1, maxWidth / image.naturalWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.naturalWidth * scale);
    canvas.height = Math.round(image.naturalHeight * scale);
    canvas.getContext("2d")?.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
