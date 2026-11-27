/** Scarica un Blob in modo affidabile (Safari/Chrome/Firefox). */
export function downloadBlob(blob: Blob, filename: string) {
  const safeName = filename.replace(/[\\/:*?"<>|]+/g, "_");
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safeName;
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  // Revocare subito può annullare il download: aspetta che parta.
  window.setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 2000);
}

export function uint8ToBlob(data: Uint8Array, mime: string): Blob {
  // Usa la view, non .buffer (può essere più grande del contenuto utile)
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return new Blob([copy], { type: mime });
}
