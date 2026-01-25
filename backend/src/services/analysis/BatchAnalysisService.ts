import { PrismaClient, File, Template } from '@prisma/client';
import { FingerprintService } from './FingerprintService';
import { TemplateMatcher } from './TemplateMatcher';
import { promises as fs } from 'fs';
import { logger } from '../../utils/logger';

import { CSVExtractionService } from '../extraction/CSVExtractionService';

export class BatchAnalysisService {
  private fingerprintService: FingerprintService;
  private templateMatcher: TemplateMatcher;
  private csvExtractionService: CSVExtractionService;

  constructor(private prisma: any) {
    this.fingerprintService = new FingerprintService();
    this.templateMatcher = new TemplateMatcher();
    this.csvExtractionService = new CSVExtractionService();
  }

  /**
   * Analyzes a batch of files: generates fingerprints and matches against templates.
   */
  async analyzeBatch(batchJobId: string, userId: string): Promise<void> {
    const batchJob = await this.prisma.batchJob.findUnique({
      where: { id: batchJobId },
      include: { files: true }
    });

    if (!batchJob) throw new Error('Batch job not found');

    const templates = await this.prisma.template.findMany({
      where: { userId, isActive: true }, // Match against active user templates
      // In a real system, you might also match against "System" built-in templates
    });

    for (const file of batchJob.files) {
      if (file.status !== 'uploaded') continue;

      try {
        await this.analyzeFile(file, templates);
      } catch (error) {
        logger.error(`Failed to analyze file ${file.id}`, { error });
        await this.prisma.file.update({
          where: { id: file.id },
          data: { status: 'failed', errorMessage: 'Analysis failed' }
        });
      }
    }

    // Update batch status
    await this.prisma.batchJob.update({
      where: { id: batchJobId },
      data: { status: 'analyzed' } // We might need to add this status to enum or use 'processing'
    });
  }

  private async analyzeFile(file: File, templates: Template[]): Promise<void> {
      // 1. Read file
      const buffer = await fs.readFile(file.filePath);

      // 2. Generate Fingerprint
      const fingerprint = await this.fingerprintService.generate(buffer);

      // 3. Match against templates
      const match = this.templateMatcher.findBestMatch(fingerprint, templates);

      // 4. Update File Record
      await this.prisma.file.update({
          where: { id: file.id },
          data: {
              fingerprint: fingerprint as any,
              matchedTemplateId: match?.templateId || null,
              matchConfidence: match?.confidence || 0,
              matchReasons: match?.reasons || [],
              status: 'analyzed' // Mark as analyzed/ready for review
          }
      });
  }
}
