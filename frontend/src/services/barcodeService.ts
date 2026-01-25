import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, Result } from '@zxing/library';

/**
 * Barcode Service (offline)
 * Tries to decode common formats (QR, Code128, Code39, EAN) from a canvas/image.
 */
export class BarcodeService {
  private static reader: BrowserMultiFormatReader | null = null;

  private static getReader(): BrowserMultiFormatReader {
    if (!this.reader) this.reader = new BrowserMultiFormatReader();
    return this.reader;
  }

  static async decodeFromCanvas(canvas: HTMLCanvasElement): Promise<string | null> {
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.QR_CODE,
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.UPC_A,
      ]);
      const reader = this.getReader();
      // BrowserMultiFormatReader doesn't accept hints via method; but internally it uses defaults
      // We instantiate with hints if needed in the future.
      const result: Result = await reader.decodeFromCanvas(canvas);
      const text = result?.getText?.() || (result as any)?.text;
      return text || null;
    } catch {
      return null;
    }
  }
}

export default BarcodeService;

