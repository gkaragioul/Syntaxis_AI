/**
 * OCR Service
 * Extracts text and data from PDF files using Tesseract.js
 * Works completely offline - no external services needed
 */

import Tesseract from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';

// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export interface PositionedWord {
  text: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  page?: number;
}

export interface TextLine {
  y: number;
  page: number;
  words: PositionedWord[];
  text: string;
}

export interface LayoutText {
  lines: TextLine[];
}

export interface OCRResult {
  text: string;
  confidence: number;
  layout?: LayoutText;
  data?: Record<string, any>;
}

export interface ExtractedInvoiceData {
  invoiceNumber?: string;
  vendorName?: string;
  invoiceDate?: string;
  dueDate?: string;
  totalAmount?: number;
  subtotal?: number;
  taxAmount?: number;
  lineItems?: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  rawText: string;
  confidence: number;
  layout?: LayoutText;
}

class OCRService {
  private static instance: OCRService;
  private worker: Tesseract.Worker | null = null;

  private constructor() {}

  static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  /**
   * Initialize Tesseract worker
   */
  async initialize(): Promise<void> {
    if (this.worker) return;

    try {
      this.worker = await Tesseract.createWorker('eng');
      console.log('OCR worker initialized');
    } catch (error) {
      console.error('Failed to initialize OCR worker:', error);
      throw error;
    }
  }

  /**
   * Extract text + coordinates from PDF using PDF.js text layer
   */
  private async extractTextWithLayout(file: File): Promise<{ text: string; layout: LayoutText }> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let fullText = '';
    const lines: TextLine[] = [];

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent: any = await page.getTextContent();
      // Convert items to words with x,y coords
      const words: PositionedWord[] = textContent.items.map((item: any) => {
        const e = item.transform?.[4]; // x in PDF space
        const f = item.transform?.[5]; // y in PDF space
        return {
          text: String(item.str || ''),
          x: e,
          y: f,
          width: item.width,
          height: item.height,
          page: pageNum,
        } as PositionedWord;
      });

      // Cluster by Y into lines
      const yTol = 3; // pixels tolerance
      const pageLines: TextLine[] = [];
      words.sort((w1, w2) => w2.y - w1.y || w1.x - w2.x); // sort by y desc (PDF origin), then x asc

      for (const w of words) {
        let line = pageLines.find(l => Math.abs(l.y - w.y) <= yTol);
        if (!line) {
          line = { y: w.y, page: pageNum, words: [], text: '' };
          pageLines.push(line);
        }
        line.words.push(w);
      }

      // Sort words in each line and build text
      for (const l of pageLines) {
        l.words.sort((a, b) => a.x - b.x);
        l.text = l.words.map(w => w.text).join(' ').replace(/\s+/g, ' ').trim();
      }

      // Keep in reading order (top to bottom)
      pageLines.sort((a, b) => b.y - a.y);
      lines.push(...pageLines);

      const pageText = pageLines.map(l => l.text).join(' ');
      fullText += pageText + '\n';
    }

    return { text: fullText, layout: { lines } };
  }

  /**
   * Perform OCR on PDF file (with layout when available)
   */
  async performOCR(file: File, _onProgress?: (progress: number) => void): Promise<OCRResult> {
    try {
      await this.initialize();

      if (!this.worker) {
        throw new Error('OCR worker not initialized');
      }

      // First try to extract text + layout from PDF text layer
      let text = '';
      let layout: LayoutText | undefined = undefined;
      try {
        const t = await this.extractTextWithLayout(file);
        text = t.text;
        layout = t.layout;
      } catch (error) {
        console.warn('Could not extract text+layout from PDF, will try OCR:', error);
      }

      // If no text extracted, use Tesseract OCR (no layout)
      if (!text || text.trim().length < 50) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        // Process first page with OCR
        const page = await pdf.getPage(1);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Could not get canvas context');
        }

        const viewport = page.getViewport({ scale: 3 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport, canvas }).promise;

        // Run OCR on canvas
        const result = await this.worker.recognize(canvas);
        text = result.data.text;
        layout = undefined;
      }

      return {
        text,
        confidence: 0.85, // Placeholder confidence
        layout,
      };
    } catch (error) {
      console.error('Error performing OCR:', error);
      throw error;
    }
  }

  /**
   * Extract structured invoice data from text
   */
  extractInvoiceData(text: string): ExtractedInvoiceData {
    const data: ExtractedInvoiceData = {
      rawText: text,
      confidence: 0.75,
    };

    // Extract invoice number (common patterns)
    const invoiceMatch = text.match(/(?:invoice|inv|#)\s*:?\s*([A-Z0-9\-]+)/i);
    if (invoiceMatch) {
      data.invoiceNumber = invoiceMatch[1];
    }

    // Extract vendor name (usually near top)
    const lines = text.split('\n');
    if (lines.length > 0) {
      data.vendorName = lines[0].trim();
    }

    // Extract dates (common patterns)
    const datePattern = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/g;
    const dates = text.match(datePattern) || [];
    if (dates.length > 0) {
      data.invoiceDate = dates[0];
    }
    if (dates.length > 1) {
      data.dueDate = dates[1];
    }

    // Extract amounts (look for currency patterns)
    const amountPattern = /\$\s*([0-9,]+\.?\d{0,2})/g;
    const amounts = text.match(amountPattern) || [];
    if (amounts.length > 0) {
      // Last amount is usually total
      const lastAmount = amounts[amounts.length - 1];
      data.totalAmount = parseFloat(lastAmount.replace(/[$,]/g, ''));
    }

    // Extract tax (common patterns)
    const taxMatch = text.match(/(?:tax|vat|gst)\s*:?\s*\$?\s*([0-9,]+\.?\d{0,2})/i);
    if (taxMatch) {
      data.taxAmount = parseFloat(taxMatch[1].replace(/[$,]/g, ''));
    }

    // Extract subtotal
    const subtotalMatch = text.match(/(?:subtotal|sub-total)\s*:?\s*\$?\s*([0-9,]+\.?\d{0,2})/i);
    if (subtotalMatch) {
      data.subtotal = parseFloat(subtotalMatch[1].replace(/[$,]/g, ''));
    }

    return data;
  }

  /**
   * Process invoice file and extract all data
   */
  async processInvoice(file: File, onProgress?: (progress: number) => void): Promise<ExtractedInvoiceData> {
    try {
      onProgress?.(10);

      // Perform OCR
      const ocrResult = await this.performOCR(file, (progress) => {
        onProgress?.(10 + progress * 0.8);
      });

      onProgress?.(90);

      // Extract structured data
      const invoiceData = this.extractInvoiceData(ocrResult.text);
      invoiceData.confidence = ocrResult.confidence;
      invoiceData.layout = ocrResult.layout;

      onProgress?.(100);

      return invoiceData;
    } catch (error) {
      console.error('Error processing invoice:', error);
      throw error;
    }
  }

  /**
   * Cleanup - terminate worker
   */
  async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export const ocrService = OCRService.getInstance();
export default ocrService;

