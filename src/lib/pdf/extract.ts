import { PDFParse } from "pdf-parse";
import { parseCalculDeContenances, type ParsedHeader, type ParsedBorne } from "./parse-bornes";

/**
 * These are ANCFCC "Calcul de Contenances" scans — almost always image-only
 * PDFs with no text layer at all (confirmed against a real sample: zero
 * output from pdftotext, a single 1-bit CCITT-fax image per page). So OCR
 * is the primary extraction path for this document type, not a rare
 * fallback — a short/empty pdf-parse result is the expected, normal case.
 */
const MIN_TEXT_LAYER_CHARS = 50;

/** 300 DPI, since the PDF's own coordinate space is 72 DPI (scale=1 there). Low-res rasterization
 * is the single biggest cause of bad OCR on these documents. */
const OCR_RENDER_SCALE = 300 / 72;

/**
 * OCR runs in a separate Python microservice (ocr-service/, official
 * PaddleOCR, onnxruntime engine) — see ocr-service/main.py — rather than
 * in-process, since there's no official PaddleOCR runtime for Node. The
 * Next.js app only rasterizes the PDF page and posts the image over HTTP.
 */
const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL ?? "http://localhost:8000";

export interface ExtractionResult {
  extractionMethod: "text-layer" | "ocr";
  header: ParsedHeader;
  bornes: ParsedBorne[];
  rawOcrText: string;
}

interface OcrServiceLine {
  text: string;
  confidence: number | null;
  box: [number, number, number, number] | null;
}

interface OcrServiceResponse {
  text: string;
  lines: OcrServiceLine[];
}

interface OcrResult {
  text: string;
  wordConfidence: Map<string, number>;
}

async function callOcrService(pageImage: Buffer): Promise<OcrServiceResponse> {
  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(pageImage)], { type: "image/png" }), "page.png");

  let response: Response;
  try {
    response = await fetch(`${OCR_SERVICE_URL}/ocr`, { method: "POST", body: formData });
  } catch (error) {
    throw new Error(
      `Service OCR (${OCR_SERVICE_URL}) injoignable : ${error instanceof Error ? error.message : String(error)}. ` +
        `Vérifiez qu'il est démarré (docker compose up -d ocr).`,
    );
  }
  if (!response.ok) {
    throw new Error(`Service OCR (${OCR_SERVICE_URL}) a répondu ${response.status} ${response.statusText}.`);
  }
  return (await response.json()) as OcrServiceResponse;
}

async function runOcr(fileBuffer: Buffer): Promise<OcrResult> {
  const parser = new PDFParse({ data: fileBuffer });
  try {
    const screenshots = await parser.getScreenshot({ scale: OCR_RENDER_SCALE });
    let text = "";
    const wordConfidence = new Map<string, number>();
    for (const page of screenshots.pages) {
      const result = await callOcrService(page.data as Buffer);
      text += `\n${result.text}`;
      for (const line of result.lines) {
        const key = line.text.trim();
        if (key && line.confidence !== null) {
          wordConfidence.set(key, Math.round(line.confidence * 100));
        }
      }
    }
    return { text, wordConfidence };
  } finally {
    await parser.destroy();
  }
}

/**
 * Extracts and parses a "Calcul de Contenances" PDF: tries the PDF's own
 * text layer first (fast, but usually absent for this document type), and
 * falls back to rasterizing at 300 DPI + PaddleOCR (French) otherwise.
 */
export async function extractCalculDeContenances(fileBuffer: Buffer): Promise<ExtractionResult> {
  const parser = new PDFParse({ data: fileBuffer });
  let textLayerText: string;
  try {
    const textResult = await parser.getText();
    textLayerText = textResult.text ?? "";
  } finally {
    await parser.destroy();
  }

  const nonWhitespaceChars = textLayerText.replace(/\s/g, "").length;
  if (nonWhitespaceChars >= MIN_TEXT_LAYER_CHARS) {
    const { header, bornes } = parseCalculDeContenances(textLayerText);
    return { extractionMethod: "text-layer", header, bornes, rawOcrText: textLayerText };
  }

  const { text: ocrText, wordConfidence } = await runOcr(fileBuffer);
  const { header, bornes } = parseCalculDeContenances(ocrText, wordConfidence);
  return { extractionMethod: "ocr", header, bornes, rawOcrText: ocrText };
}
