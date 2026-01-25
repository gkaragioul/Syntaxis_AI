// @ts-nocheck

import {
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OcrService } from './ocr.service';

@Controller('api/ocr')
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  /**
   * POST /api/ocr/extract
   * Accepts a file upload and returns extracted text and confidence
   */
  @Post('extract')
  @UseInterceptors(FileInterceptor('file'))
  async extractText(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    const result = await this.ocrService.extractText(file.buffer);
    return {
      text: result.text,
      confidence: result.confidence,
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    };
  }
}
