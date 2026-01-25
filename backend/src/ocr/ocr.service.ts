import { Injectable, Logger } from '@nestjs/common';
import * as Tesseract from 'tesseract.js';

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  /**
   * Process an image buffer and extract text using Tesseract.js
   * @param buffer - The image or PDF buffer
   * @param lang - Language for OCR (default: 'eng')
   */
  async extractText(
    buffer: Buffer,
    lang = 'eng',
  ): Promise<{ text: string; confidence: number }> {
    try {
      const { data } = await Tesseract.recognize(buffer, lang, {
        logger: (m) =>
          this.logger.debug(`[Tesseract] ${m.status}: ${m.progress}`),
      });
      return {
        text: data.text,
        confidence: data.confidence || 0,
      };
    } catch (error) {
      this.logger.error('OCR extraction failed', error);
      throw error;
    }
  }
}
