/** Longest side sent to the AI (ARCHITECTURE §6.5). */
export const MAX_SIDE = 1600;
const SENDABLE = ["image/png", "image/jpeg", "image/webp"];
/** Pictures already small enough are sent as they are. */
const SMALL_BYTES = 1.5 * 1024 * 1024;

/** The size that fits inside `max` × `max`, keeping the shape. Never enlarges. */
export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const scale = Math.min(1, max / Math.max(width, height, 1));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Shrinks a picture in the webview before it goes to Rust (no image library needed).
 * Returns the bytes and their type for the `x-image-type` header.
 */
export async function shrinkImage(blob: Blob): Promise<{ bytes: Uint8Array; type: string }> {
  const bitmap = await createImageBitmap(blob);
  const size = fitWithin(bitmap.width, bitmap.height);
  if (size.width === bitmap.width && SENDABLE.includes(blob.type) && blob.size <= SMALL_BYTES) {
    bitmap.close();
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type.slice(6) };
  }
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const out = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!out) throw new Error("image");
  return { bytes: new Uint8Array(await out.arrayBuffer()), type: "jpeg" };
}
