/**
 * Shrinks a receipt photo to max 1000 px / JPEG q0.6 (typically 60–150 KB) so it
 * fits as a base64 data URL inside a Firestore expense doc (1 MB doc limit, no
 * Firebase Storage bucket in this project). PDFs and small files pass through.
 */
export async function compressReceipt(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 150_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.6));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Reads a Blob as a base64 data URL (used to store receipts inline in Firestore). */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
