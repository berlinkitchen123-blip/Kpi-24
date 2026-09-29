/**
 * Shrinks a receipt photo to max 1600 px / JPEG q0.75 (typically 150–400 KB)
 * so uploads work on a weak mobile connection. PDFs and small files pass through.
 */
export async function compressReceipt(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size < 300_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.75));
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
