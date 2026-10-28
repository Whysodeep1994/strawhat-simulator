/**
 * Each seat's playmat: one of the ready-made mats, or a picture the player uploaded. The choice
 * stays in this browser only (localStorage); in online play each player's mat goes to their friend
 * (see Looks in online.ts).
 */
export type MatSeat = "you" | "opponent";

/** The ready-made mats, drawn in mat-art.ts. A chosen one is saved as "preset:<id>". */
export const MAT_PRESETS = [
  { id: "sunset", name: "Grand Line Sunset" },
  { id: "treasure-map", name: "Treasure Map" },
  { id: "lawn-deck", name: "Lawn Deck" },
  { id: "wanted", name: "Wanted Posters" },
  { id: "straw-hat", name: "Straw Hat" },
  { id: "wano", name: "Wano by Moonlight" },
  { id: "sky-island", name: "Sky Island" },
  { id: "fish-man-island", name: "Fish-Man Island" },
] as const;
export type MatPresetId = (typeof MAT_PRESETS)[number]["id"];

const PRESET = "preset:";

export function presetChoice(id: MatPresetId): string {
  return PRESET + id;
}

/** The ready-made mat a saved choice names, or null for an upload, the default, or a mat that no longer exists. */
export function presetOf(choice: string | null): MatPresetId | null {
  if (!choice?.startsWith(PRESET)) return null;
  const id = choice.slice(PRESET.length);
  return MAT_PRESETS.find((p) => p.id === id)?.id ?? null;
}

/** Whether a saved choice is an uploaded picture (rather than a ready-made mat or the default). */
export function isUpload(choice: string | null): boolean {
  return !!choice && !choice.startsWith(PRESET);
}

const key = (seat: MatSeat) => `strawhat.playmat.${seat}`;

export function loadMat(seat: MatSeat): string | null {
  try {
    return localStorage.getItem(key(seat));
  } catch {
    return null;
  }
}

/** Returns false when the browser refused to store it (private mode or out of space). */
export function saveMat(seat: MatSeat, choice: string | null): boolean {
  try {
    if (choice) localStorage.setItem(key(seat), choice);
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
