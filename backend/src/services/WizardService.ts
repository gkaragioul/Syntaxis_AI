// @ts-nocheck

import { PrismaClient, WizardSession, BatchJob, File, Template } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// Types matching frontend wizard.ts
export type WizardState =
  | 'UPLOAD_READY'
  | 'UPLOADING'
  | 'GROUPING'
  | 'GROUPS_READY'
  | 'SETUP_IN_PROGRESS'
  | 'EXPORT_RUNNING'
  | 'EXPORT_DONE';

export interface WizardGroup {
  id: string;
  name: string;
  fileCount: number;
  status: 'ready' | 'needs_setup' | 'not_supported';
  files: WizardFile[];
  representativeFileId?: string;
  _templateId?: string;
}

export interface WizardFile {
  id: string;
  filename: string;
  pageCount?: number;
  exportStatus?: 'pending' | 'exported' | 'needs_review' | 'failed';
  reviewReason?: string;
}

export interface SetupConfig {
  tableRegion: {
    x: number;
    y: number;
    width: number;
    height: number;
    page?: number;
  };
  headerRows: number;
  columnGuides?: number[];
  preferredColumnMode?: string;
  advanced: {
    dropTotals: boolean;
    removeFootnotes: boolean;
    strictMode: boolean;
  };
}

export interface GroupExportResult {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  totalFiles: number;
  exportedFiles: number;
  filesWithWarnings: number;
  failedFiles: number;
  downloadUrl?: string;
  completedAt?: string;
  fileResults: Array<{
    fileId: string;
    filename: string;
    status: 'pending' | 'exported' | 'needs_review' | 'failed';
    reason?: string;
    csvPath?: string;
  }>;
}

export class WizardService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create a new wizard session for a user
   */
  async createSession(userId: string): Promise<WizardSession> {
    const session = await this.prisma.wizardSession.create({
      data: {
        userId,
        state: 'UPLOAD_READY',
        currentStep: 1,
      },
    });

    logger.info('Created wizard session', { sessionId: session.id, userId });
    return session;
  }

  /**
   * Get session by ID, ensuring it belongs to the user
   */
  async getSession(sessionId: string, userId: string): Promise<WizardSession | null> {
    return this.prisma.wizardSession.findFirst({
      where: {
        id: sessionId,
        userId,
      },
    });
  }

  /**
   * Get the latest incomplete session for a user (for auto-resume)
   */
  async getLatestIncompleteSession(userId: string): Promise<WizardSession | null> {
    return this.prisma.wizardSession.findFirst({
      where: {
        userId,
        state: {
          not: 'EXPORT_DONE',
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  /**
   * Update session state
   */
  async updateState(
    sessionId: string,
    userId: string,
    state: WizardState,
    currentStep?: number
  ): Promise<WizardSession> {
    const stepMap: Record<WizardState, number> = {
      UPLOAD_READY: 1,
      UPLOADING: 1,
      GROUPING: 2,
      GROUPS_READY: 2,
      SETUP_IN_PROGRESS: 3,
      EXPORT_RUNNING: 4,
      EXPORT_DONE: 4,
    };

    const session = await this.prisma.wizardSession.update({
      where: { id: sessionId },
      data: {
        state,
        currentStep: currentStep ?? stepMap[state],
      },
    });

    logger.info('Updated wizard state', { sessionId, state, currentStep: session.currentStep });
    return session;
  }

  /**
   * Associate a batch job with the wizard session after upload
   */
  async setBatchJob(sessionId: string, batchJobId: string): Promise<WizardSession> {
    return this.prisma.wizardSession.update({
      where: { id: sessionId },
      data: {
        batchJobId,
        state: 'GROUPING',
        currentStep: 2,
      },
    });
  }

  /**
   * Get groups from a batch job's template matching results
   * Transforms the internal bucket structure to user-friendly groups
   */
  async getGroups(sessionId: string, userId: string): Promise<WizardGroup[]> {
    const session = await this.getSession(sessionId, userId);
    if (!session || !session.batchJobId) {
      return [];
    }

    // Get batch job with files and their template matches
    const batchJob = await this.prisma.batchJob.findUnique({
      where: { id: session.batchJobId },
      include: {
        files: {
          include: {
            matchedTemplate: true,
          },
        },
      },
    });

    if (!batchJob) {
      return [];
    }

    // Group files by template
    const templateGroups = new Map<string | null, File[]>();
    const scannedFiles: File[] = [];

    for (const file of batchJob.files) {
      // Check if file is a scanned/image PDF (not supported)
      if (file.processingStatus === 'scanned' || file.status === 'scanned') {
        scannedFiles.push(file);
        continue;
      }

      const templateId = file.matchedTemplateId;
      if (!templateGroups.has(templateId)) {
        templateGroups.set(templateId, []);
      }
      templateGroups.get(templateId)!.push(file);
    }

    const groups: WizardGroup[] = [];
    let groupIndex = 0;

    // Create groups for matched templates (ready to export)
    for (const [templateId, files] of templateGroups) {
      if (templateId) {
        const template = await this.prisma.template.findUnique({
          where: { id: templateId },
        });

        groups.push({
          id: `group-${templateId}`,
          name: template?.vendorName || template?.name || `Document Type ${++groupIndex}`,
          fileCount: files.length,
          status: 'ready',
          files: files.map(f => ({
            id: f.id,
            filename: f.originalFilename,
            exportStatus: 'pending',
          })),
          representativeFileId: files[0]?.id,
          _templateId: templateId,
        });
      }
    }

    // Create groups for unmatched files (needs setup)
    const unassignedFiles = templateGroups.get(null) || [];
    if (unassignedFiles.length > 0) {
      // For MVP, put all unassigned in one group
      // TODO: Implement auto-clustering to split into multiple groups
      const clusteredGroups = this.clusterUnassignedFiles(unassignedFiles);

      for (const cluster of clusteredGroups) {
        groups.push({
          id: `group-unassigned-${++groupIndex}`,
          name: `Group ${String.fromCharCode(64 + groupIndex)}`, // Group A, B, C...
          fileCount: cluster.length,
          status: 'needs_setup',
          files: cluster.map(f => ({
            id: f.id,
            filename: f.originalFilename,
            exportStatus: 'pending',
          })),
          representativeFileId: cluster[0]?.id,
        });
      }
    }

    // Create group for scanned PDFs (not supported)
    if (scannedFiles.length > 0) {
      groups.push({
        id: 'group-scanned',
        name: 'Scanned PDFs',
        fileCount: scannedFiles.length,
        status: 'not_supported',
        files: scannedFiles.map(f => ({
          id: f.id,
          filename: f.originalFilename,
        })),
      });
    }

    // Cache groups data in session
    await this.prisma.wizardSession.update({
      where: { id: sessionId },
      data: {
        groupsData: {
          groups,
          totalFiles: batchJob.files.length,
          lastUpdated: new Date().toISOString(),
        },
        state: 'GROUPS_READY',
      },
    });

    return groups;
  }

  /**
   * Simple clustering for unassigned files
   * MVP: Returns all files in one group
   * TODO: Implement actual clustering based on page structure similarity
   */
  private clusterUnassignedFiles(files: File[]): File[][] {
    // For MVP, just return all files as one cluster
    // In future: implement k-means or hierarchical clustering based on:
    // - Page count
    // - Text block positions (from fingerprint)
    // - Table structure similarity
    if (files.length === 0) return [];
    return [files];
  }

  /**
   * Save setup configuration for a group
   * This creates or updates a template internally
   */
  async saveSetup(
    sessionId: string,
    userId: string,
    groupId: string,
    config: SetupConfig
  ): Promise<WizardGroup | null> {
    const session = await this.getSession(sessionId, userId);
    if (!session) return null;

    const groupsData = session.groupsData as { groups: WizardGroup[] } | null;
    if (!groupsData) return null;

    const group = groupsData.groups.find(g => g.id === groupId);
    if (!group || group.status !== 'needs_setup') return null;

    // Get representative file for fingerprinting
    const representativeFile = group.representativeFileId
      ? await this.prisma.file.findUnique({
          where: { id: group.representativeFileId },
        })
      : null;

    // Create extraction schema from setup config
    const extractionSchema = {
      version: '1.0',
      anchors: [],
      tables: [
        {
          id: 'table1',
          pages: 'all',
          region: {
            mode: 'absolute',
            bbox: {
              x0: config.tableRegion.x,
              y0: config.tableRegion.y,
              x1: config.tableRegion.x + config.tableRegion.width,
              y1: config.tableRegion.y + config.tableRegion.height,
            },
          },
          header: {
            depthRows: config.headerRows,
            repeatEachPage: false,
          },
          columns: {
            mode: config.columnGuides ? 'manual' : 'auto',
            guides: config.columnGuides || null,
            preferredColumnMode: config.preferredColumnMode || null,
          },
          cleanup: {
            dropEmptyRows: true,
            dropTotalsRows: config.advanced.dropTotals,
            removeFootnotesArea: config.advanced.removeFootnotes,
          },
          output: {
            sheetName: 'Sheet1',
            normalizeNumbers: true,
            keepCurrencySymbols: false,
          },
        },
      ],
      driftDetection: {
        maxAnchorDistancePx: 50,
        failOnDrift: config.advanced.strictMode,
      },
    };

    // Create template
    const template = await this.prisma.template.create({
      data: {
        userId,
        name: group.name,
        vendorName: group.name,
        patterns: {},
        fieldMappings: {},
        extractionSchema,
        isActive: true,
      },
    });

    // Update all files in the group to match this template
    const fileIds = group.files.map(f => f.id);
    await this.prisma.file.updateMany({
      where: { id: { in: fileIds } },
      data: {
        matchedTemplateId: template.id,
        matchConfidence: 1.0,
      },
    });

    // Update group status
    const updatedGroup: WizardGroup = {
      ...group,
      status: 'ready',
      _templateId: template.id,
    };

    // Update session with new groups data
    const updatedGroups = groupsData.groups.map(g =>
      g.id === groupId ? updatedGroup : g
    );

    await this.prisma.wizardSession.update({
      where: { id: sessionId },
      data: {
        groupsData: {
          ...groupsData,
          groups: updatedGroups,
          lastUpdated: new Date().toISOString(),
        },
        state: 'GROUPS_READY',
      },
    });

    logger.info('Saved setup for group', {
      sessionId,
      groupId,
      templateId: template.id,
    });

    return updatedGroup;
  }

  /**
   * Start export for a group
   */
  async exportGroup(
    sessionId: string,
    userId: string,
    groupId: string
  ): Promise<GroupExportResult | null> {
    const session = await this.getSession(sessionId, userId);
    if (!session) return null;

    const groupsData = session.groupsData as { groups: WizardGroup[] } | null;
    if (!groupsData) return null;

    const group = groupsData.groups.find(g => g.id === groupId);
    if (!group || group.status !== 'ready') return null;

    // Initialize export result
    const exportResult: GroupExportResult = {
      status: 'running',
      progress: 0,
      totalFiles: group.fileCount,
      exportedFiles: 0,
      filesWithWarnings: 0,
      failedFiles: 0,
      fileResults: group.files.map(f => ({
        fileId: f.id,
        filename: f.filename,
        status: 'pending',
      })),
    };

    // Update session state
    const exportResults = (session.exportResults as Record<string, GroupExportResult>) || {};
    exportResults[groupId] = exportResult;

    await this.prisma.wizardSession.update({
      where: { id: sessionId },
      data: {
        state: 'EXPORT_RUNNING',
        currentStep: 4,
        exportResults,
      },
    });

    // TODO: Queue actual export job
    // For now, simulate immediate completion
    await this.processGroupExport(sessionId, userId, groupId);

    return exportResult;
  }

  /**
   * Process export for a group (called by worker or inline for MVP)
   */
  private async processGroupExport(
    sessionId: string,
    userId: string,
    groupId: string
  ): Promise<void> {
    const session = await this.getSession(sessionId, userId);
    if (!session) return;

    const exportResults = (session.exportResults as Record<string, GroupExportResult>) || {};
    const exportResult = exportResults[groupId];
    if (!exportResult) return;

    // Simulate processing each file
    // TODO: Integrate with actual extraction/export logic
    for (let i = 0; i < exportResult.fileResults.length; i++) {
      const fileResult = exportResult.fileResults[i];

      // Simulate success with occasional warnings
      const rand = Math.random();
      if (rand < 0.85) {
        fileResult.status = 'exported';
        exportResult.exportedFiles++;
      } else if (rand < 0.95) {
        fileResult.status = 'needs_review';
        fileResult.reason = 'Layout changed slightly from the setup document';
        exportResult.filesWithWarnings++;
        exportResult.exportedFiles++;
      } else {
        fileResult.status = 'failed';
        fileResult.reason = 'Could not extract table data';
        exportResult.failedFiles++;
      }

      exportResult.progress = Math.round(((i + 1) / exportResult.fileResults.length) * 100);
    }

    exportResult.status = 'completed';
    exportResult.completedAt = new Date().toISOString();
    // TODO: Generate actual ZIP file and URL
    exportResult.downloadUrl = `/api/v1/wizard/${sessionId}/download/${groupId}`;

    // Update session
    await this.prisma.wizardSession.update({
      where: { id: sessionId },
      data: {
        exportResults,
        state: 'EXPORT_DONE',
      },
    });

    logger.info('Completed group export', {
      sessionId,
      groupId,
      exported: exportResult.exportedFiles,
      warnings: exportResult.filesWithWarnings,
      failed: exportResult.failedFiles,
    });
  }

  /**
   * Get export results for a session
   */
  async getExportResults(
    sessionId: string,
    userId: string
  ): Promise<Record<string, GroupExportResult> | null> {
    const session = await this.getSession(sessionId, userId);
    if (!session) return null;
    return (session.exportResults as Record<string, GroupExportResult>) || {};
  }

  /**
   * Delete a wizard session
   */
  async deleteSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.getSession(sessionId, userId);
    if (!session) return false;

    await this.prisma.wizardSession.delete({
      where: { id: sessionId },
    });

    logger.info('Deleted wizard session', { sessionId, userId });
    return true;
  }
}

// Export singleton instance (will be initialized with prisma in app setup)
let wizardService: WizardService | null = null;

export function initWizardService(prisma: PrismaClient): WizardService {
  wizardService = new WizardService(prisma);
  return wizardService;
}

export function getWizardService(): WizardService {
  if (!wizardService) {
    throw new Error('WizardService not initialized. Call initWizardService first.');
  }
  return wizardService;
}
