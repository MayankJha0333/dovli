// A page as a PDF, sent through the phone's share sheet. The HTML comes from the page drawn in a
// web view (see dom/PageEditorDom.tsx and dom/BoardPrintDom.tsx), so the PDF looks like the page.

import { File, Paths } from "expo-file-system";
import { printToFileAsync } from "expo-print";
import { isAvailableAsync, shareAsync } from "expo-sharing";

/** A file name every phone and computer accepts. */
function safeName(title: string): string {
  const clean = title.replace(/[\\/:*?"<>|#^[\]\n\r\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
  return clean || "Untitled";
}

export async function sharePdf(html: string, title: string): Promise<void> {
  // A4, in points.
  const { uri } = await printToFileAsync({ html, width: 595, height: 842 });
  // The printer names its file at random: give it the page's name, which the share sheet shows.
  const named = new File(Paths.cache, `${safeName(title)}.pdf`);
  if (named.exists) named.delete();
  await new File(uri).move(named);
  if (!(await isAvailableAsync())) throw new Error("Sharing files isn't available on this phone.");
  await shareAsync(named.uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf", dialogTitle: title });
}
