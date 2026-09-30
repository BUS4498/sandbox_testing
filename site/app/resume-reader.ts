"use client";

import { strFromU8, unzipSync } from "fflate";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { linesFromPdfTextItems } from "@/lib/resume-pdf-text.js";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_TEXT = 30_000;

export async function readResumeOnDevice(file: File): Promise<string> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (!extension || !["docx", "pdf", "md", "txt"].includes(extension)) throw new Error("Choose a .docx, .pdf, .md, or .txt resume.");
  if (!file.size || file.size > MAX_BYTES) throw new Error("Choose a non-empty resume no larger than 5 MB.");
  let extracted = "";
  if (extension === "md" || extension === "txt") {
    extracted = await file.text();
  } else if (extension === "docx") {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const entries = unzipSync(bytes, { filter: (entry) => entry.name === "word/document.xml" });
    const xml = entries["word/document.xml"];
    if (!xml || xml.length > 3_000_000) throw new Error("The Word file does not contain a readable resume document.");
    const document = new DOMParser().parseFromString(strFromU8(xml), "application/xml");
    if (document.getElementsByTagName("parsererror").length) throw new Error("The Word document could not be read.");
    const paragraphs = document.getElementsByTagNameNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "p");
    extracted = Array.from(paragraphs, (paragraph) => paragraph.textContent?.trim() ?? "").filter(Boolean).join("\n");
  } else {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()), useSystemFonts: true });
    const pdf = await task.promise;
    if (pdf.numPages > 30) throw new Error("Choose a resume of 30 pages or fewer.");
    const pages: string[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(linesFromPdfTextItems(content.items).join("\n"));
      if (pages.join("\n").length > MAX_TEXT) throw new Error("The extracted resume is too long to review here.");
    }
    extracted = pages.join("\n");
    await pdf.destroy();
  }
  const text = extracted.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").trim();
  if (text.length < 40) throw new Error("The resume did not contain enough readable text. Try a text-based file instead of a scan.");
  if (text.length > MAX_TEXT) throw new Error("The extracted resume exceeds the 30,000-character review limit.");
  return text;
}
