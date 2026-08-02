// Client-side PDF text extraction.
//
// Runs entirely in the browser so an uploaded résumé never leaves the device —
// the same guarantee the rest of the analysis makes. pdf.js is loaded lazily on
// first upload rather than shipped in the initial bundle.

import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export type PdfExtraction = {
  text: string;
  pages: number;
  words: number;
};

/** Thrown with a message intended to be shown to the user as-is. */
export class PdfReadError extends Error {}

type PositionedItem = {
  str: string;
  x: number;
  y: number;
  width: number;
};

export function isPdfFile(file: File): boolean {
  return file.type === "application/pdf" || /\.pdf$/i.test(file.name);
}

export async function extractPdfText(file: File): Promise<PdfExtraction> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    // No network fetches for fonts; everything stays on the device.
    useSystemFonts: false,
  });

  let doc;
  try {
    doc = await loadingTask.promise;
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "PasswordException") {
      throw new PdfReadError("That PDF is password-protected. Remove the password and try again.");
    }
    if (name === "InvalidPDFException") {
      throw new PdfReadError("That file isn’t a readable PDF — it may be damaged. Try exporting it again.");
    }
    throw new PdfReadError("That PDF couldn’t be opened. Try re-exporting it from your editor.");
  }

  const lines: string[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();

    // PDFs store loose positioned glyph runs, not lines. Group runs by their
    // vertical position (with a small tolerance for baseline jitter), then
    // order left-to-right, so the résumé reviewer sees real lines to critique.
    const rows = new Map<number, PositionedItem[]>();
    for (const raw of content.items) {
      const item = raw as Partial<PositionedItem> & { str?: string; transform?: number[] };
      if (typeof item.str !== "string" || item.str.trim() === "" || !item.transform) continue;
      const y = Math.round(item.transform[5] / 2) * 2;
      const row = rows.get(y);
      const positioned: PositionedItem = {
        str: item.str,
        x: item.transform[4],
        y,
        width: typeof item.width === "number" ? item.width : 0,
      };
      if (row) row.push(positioned);
      else rows.set(y, [positioned]);
    }

    const ordered = [...rows.entries()].sort((a, b) => b[0] - a[0]);
    for (const [, items] of ordered) {
      items.sort((a, b) => a.x - b.x);
      let line = "";
      let previousEnd: number | null = null;
      for (const item of items) {
        // Insert a space when there is a visible gap the glyph runs don't carry.
        if (previousEnd !== null && item.x - previousEnd > 1) line += " ";
        line += item.str;
        previousEnd = item.x + item.width;
      }
      const cleaned = line.replace(/\s+/g, " ").trim();
      if (cleaned) lines.push(cleaned);
    }
  }

  const pages = doc.numPages;
  await loadingTask.destroy();

  const text = lines.join("\n").trim();
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;

  if (words < 10) {
    throw new PdfReadError(
      "No text could be read from that PDF — it looks like a scan or an image. Export a text-based PDF from your editor, or paste your experience as text instead.",
    );
  }

  return { text, pages, words };
}
