import Tesseract from 'tesseract.js';
import CVPreprocessService from './cvPreprocessService';
import BarcodeService from './barcodeService';
import AnchorExtractionService from './anchorExtractionService';
import { InvoiceType } from './invoiceTypeDetector';
import onnxOcrService from './onnxOcrService';
import ReliabilitySettingsService from './reliabilitySettingsService';
import VendorTemplateService from './vendorTemplateService';

export interface EnhanceOptions {
  dpiScale?: number; // 2 -> 150dpi-ish; 3 -> ~225dpi; 4 -> ~300dpi depending on PDF units
  tryBarcode?: boolean;
  tryOpenCV?: boolean;
  tryOnnx?: boolean;
  tryRoiCropping?: boolean;
}

export class ReliabilityEnhancer {
  static async renderFirstPageCanvas(file: File, scale = 3): Promise<HTMLCanvasElement> {
    const { default: pdfjsLib } = await import('pdfjs-dist');
    // Ensure worker is set (mirrors ocrService). Note: current setup uses CDN worker; can be swapped to local if needed.
    try {
      const ver = (pdfjsLib as any).version || '3.11.174';
      (pdfjsLib as any).GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${ver}/pdf.worker.min.js`;
    } catch {}
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await (pdfjsLib as any).getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No canvas 2D context');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    return canvas;
  }

  static async improveFullPageText(
    file: File,
    rawText: string,
    invoiceType: InvoiceType,
    vendorName?: string,
    opts: EnhanceOptions = {}
  ): Promise<{ improvedText: string | null; extracted?: ReturnType<typeof AnchorExtractionService.extractFields> }>
  {
    const s = ReliabilitySettingsService.get();
    const options: Required<EnhanceOptions> = {
      dpiScale: s.dpiScale ?? 3,
      tryBarcode: s.enableBarcode,
      tryOpenCV: s.enableOpenCV,
      tryOnnx: s.enableOnnx,
      tryRoiCropping: s.enableRoiCropping,
      ...opts,
    } as any;

    // Render canvas
    const baseCanvas = await this.renderFirstPageCanvas(file, options.dpiScale);

    // 1) Barcode attempt (invoice number)
    let barcodeInvoice: string | null = null;
    if (options.tryBarcode) {
      barcodeInvoice = await BarcodeService.decodeFromCanvas(baseCanvas);
    }

    // 2) OpenCV preprocessing and Tesseract pass (full-page)
    let enhancedCanvas: HTMLCanvasElement | null = null;
    let enhancedText: string | null = null;
    let tessWords: any[] | undefined = undefined;
    if (options.tryOpenCV) {
      try {
        enhancedCanvas = await CVPreprocessService.enhanceForOCR(baseCanvas, { adaptive: true, invertIfNeeded: true, deskew: true });
        const tessRes = await Tesseract.recognize(enhancedCanvas, 'eng', {
          tessedit_pageseg_mode: 6,
          user_defined_dpi: Math.round(72 * options.dpiScale),
        } as any);
        enhancedText = tessRes.data.text;
        tessWords = (tessRes as any)?.data?.words || [];
      } catch (e) {
        console.warn('OpenCV/Tesseract enhance pass failed', e);
      }
    }

    // 3) ONNX fallback (if models installed)
    let onnxText: string | null = null;
    if (options.tryOnnx) {
      try {
        const init = await onnxOcrService.initialize();
        if (init.available) {
          onnxText = await onnxOcrService.recognizeText(enhancedCanvas || baseCanvas);
        }
      } catch (e) {
        console.warn('ONNX fallback failed', e);
      }
    }

    // Choose best text among candidates by simple heuristic: prefer longest plausible
    const candidates = [rawText, enhancedText, onnxText].filter(Boolean) as string[];
    const improved = candidates.sort((a, b) => b.length - a.length)[0] || null;

    let mergedText = improved;
    if (mergedText && barcodeInvoice) {
      // If barcode invoice number present, ensure it exists in text (helps anchor regex later)
      mergedText += `\nInvoice #: ${barcodeInvoice}`;
    }

    if (!mergedText) return { improvedText: null };

    // Re-run anchor extraction on improved text
    const extracted = AnchorExtractionService.extractFields(
      mergedText,
      undefined, // layout not available from OCR pass
      invoiceType,
      vendorName
    );

    // If we got barcode invoice, override
    if (barcodeInvoice) {
      extracted.fields.invoiceNumber = barcodeInvoice;
      extracted.fieldConfidence.invoiceNumber = 0.99;
    }

    // ROI cropping pass: targeted OCR to refine key fields (faster and often more accurate)
    if (options.tryRoiCropping) {
      try {
        const source = enhancedCanvas || baseCanvas;
        // If we didn't run the OpenCV + Tesseract pass, get some words now from base canvas
        if (!tessWords || tessWords.length === 0) {
          const quick = await Tesseract.recognize(source, 'eng', { tessedit_pageseg_mode: 6 } as any);
          tessWords = (quick as any)?.data?.words || [];
        }
        const roi = await targetedRoiPass(source, tessWords, invoiceType, vendorName);
        for (const [k, v] of Object.entries(roi.fields)) {
          if (!v) continue;
          const oldC = extracted.fieldConfidence[k] || 0;
          const newC = roi.fieldConfidence[k] || 0;
          if (!(extracted.fields as any)[k] || newC >= oldC) {
            (extracted.fields as any)[k] = v as any;
            extracted.fieldConfidence[k] = Math.max(oldC, newC);
          }
        }
      } catch (e) {
        console.warn('ROI cropping pass failed', e);
      }
    }

    return { improvedText: mergedText, extracted };
  }
}

export default ReliabilityEnhancer;



/**
 * ROI-based targeted OCR for key fields using Tesseract word boxes.
 * Heuristic: find anchor terms in recognized lines, then OCR a narrow ROI to the right.
 */
async function targetedRoiPass(
  canvas: HTMLCanvasElement,
  tessWords: any[] | undefined,
  _invoiceType: InvoiceType,
  vendorName?: string
): Promise<{ fields: Partial<Record<'invoiceNumber'|'invoiceDate'|'dueDate'|'totalAmount', string>>; fieldConfidence: Record<string, number> }>
{
  const outFields: any = {};
  const conf: Record<string, number> = {};
  if (!tessWords || tessWords.length === 0) return { fields: outFields, fieldConfidence: conf };

  // minimal anchor sets + vendor overrides
  const baseAnchors: Record<string, string[]> = {
    invoiceNumber: ['invoice number', 'invoice no', 'invoice #', 'inv #', 'inv no', 'inv.'],
    invoiceDate: ['invoice date', 'date issued', 'date'],
    dueDate: ['due date', 'payment due', 'pay by'],
    totalAmount: ['total', 'amount due', 'grand total', 'balance due'],
  };
  if (vendorName) {
    const vtpl = VendorTemplateService.getAnchorsForVendor(vendorName) || {};
    for (const k of Object.keys(baseAnchors)) {
      const merged = new Set([...(baseAnchors[k] || []), ...((vtpl as any)[k] || [])]);
      baseAnchors[k] = Array.from(merged);
    }
  }

  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s:#.%]/g, ' ').replace(/\s+/g, ' ').trim();

  // group words by rough line using y centroid
  const lines: any[] = [];
  const tol = 8; // px tolerance for line grouping
  for (const w of tessWords) {
    const cy = (w.bbox?.y0 + w.bbox?.y1) / 2 || w.bbox?.y0 || 0;
    let line = lines.find(l => Math.abs(l.cy - cy) <= tol);
    if (!line) { line = { cy, words: [] as any[] }; lines.push(line); }
    line.words.push(w);
    line.cy = (line.cy * (line.words.length - 1) + cy) / line.words.length;
  }

  const canvasW = canvas.width;

  async function ocrRoi(x0: number, y0: number, x1: number, y1: number, whitelist?: string) {
    const rx0 = Math.max(0, Math.floor(x0));
    const ry0 = Math.max(0, Math.floor(y0));
    const rw = Math.max(1, Math.min(canvasW - rx0, Math.floor(x1 - x0)));
    const rh = Math.max(1, Math.floor(y1 - y0));
    const roiCanvas = document.createElement('canvas');
    roiCanvas.width = rw; roiCanvas.height = rh;
    const ctx = roiCanvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(canvas, rx0, ry0, rw, rh, 0, 0, rw, rh);
    const cfg: any = { tessedit_pageseg_mode: 7 };
    if (whitelist) cfg.tessedit_char_whitelist = whitelist;
    const r = await Tesseract.recognize(roiCanvas, 'eng', cfg as any);
    return (r?.data?.text || '').trim();
  }

  function findAnchor(lineText: string, anchors: string[]): boolean {
    const lt = norm(lineText);
    return anchors.some(a => lt.includes(norm(a)));
  }

  for (const line of lines) {
    const xMax = Math.max(...line.words.map((w: any) => w.bbox.x1));
    const yMin = Math.min(...line.words.map((w: any) => w.bbox.y0));
    const yMax = Math.max(...line.words.map((w: any) => w.bbox.y1));
    const text = line.words.map((w: any) => w.text).join(' ');

    // Invoice Number
    if (!outFields.invoiceNumber && findAnchor(text, baseAnchors.invoiceNumber)) {
      const x0 = xMax + 6, x1 = Math.min(canvasW, xMax + Math.max(80, canvasW * 0.35));
      const txt = await ocrRoi(x0, yMin - 2, x1, yMax + 2, 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_/\\#');
      if (txt) { outFields.invoiceNumber = txt.split(/\s+/)[0]; conf.invoiceNumber = 0.92; }
    }
    // Invoice Date
    if (!outFields.invoiceDate && findAnchor(text, baseAnchors.invoiceDate)) {
      const x0 = xMax + 6, x1 = Math.min(canvasW, xMax + Math.max(80, canvasW * 0.3));
      const txt = await ocrRoi(x0, yMin - 2, x1, yMax + 2, '0123456789/-.');
      if (txt) { outFields.invoiceDate = txt.match(/[0-9]{1,4}[./\-][0-9]{1,2}[./\-][0-9]{1,4}/)?.[0] || txt; conf.invoiceDate = 0.9; }
    }
    // Due Date
    if (!outFields.dueDate && findAnchor(text, baseAnchors.dueDate)) {
      const x0 = xMax + 6, x1 = Math.min(canvasW, xMax + Math.max(80, canvasW * 0.3));
      const txt = await ocrRoi(x0, yMin - 2, x1, yMax + 2, '0123456789/-.');
      if (txt) { outFields.dueDate = txt.match(/[0-9]{1,4}[./\-][0-9]{1,2}[./\-][0-9]{1,4}/)?.[0] || txt; conf.dueDate = 0.88; }
    }
    // Total Amount
    if (!outFields.totalAmount && findAnchor(text, baseAnchors.totalAmount)) {
      const x0 = xMax + 6, x1 = Math.min(canvasW, xMax + Math.max(100, canvasW * 0.4));
      const txt = await ocrRoi(x0, yMin - 2, x1, yMax + 2, '0123456789.,$£€-()');
      if (txt) { outFields.totalAmount = txt.match(/[€$£]?\s?\d[\d.,]*/)?.[0] || txt; conf.totalAmount = 0.93; }
    }
  }

  return { fields: outFields, fieldConfidence: conf };
}
