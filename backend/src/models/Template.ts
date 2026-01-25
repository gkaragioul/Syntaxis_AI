import { prisma } from '../prisma';
import { Template as PrismaTemplate } from '@prisma/client';

export type Template = PrismaTemplate;

export interface CreateTemplateInput {
  userId: string;
  name: string;
  vendorName: string;
  patterns: any;
  fieldMappings: any;
  templateType?: string;
  language?: string;
  description?: string;
  metadata?: any;
}

export interface UpdateTemplateInput {
  name?: string;
  vendorName?: string;
  patterns?: any;
  fieldMappings?: any;
  templateType?: string;
  language?: string;
  isActive?: boolean;
  description?: string;
  metadata?: any;
  successRate?: number;
  usageCount?: number;
}

export interface TemplateApplication {
  id: string;
  userId: string;
  templateId: string;
  extractionId: string;
  status: string;
  confidence: number;
  validationErrors?: any;
  createdAt: Date;
  updatedAt: Date;
}

export class TemplateError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'TemplateError';
  }
}

export class TemplateModel {
  static async create(data: CreateTemplateInput): Promise<PrismaTemplate> {
    return await prisma.template.create({
      data: {
        ...data,
        patterns: data.patterns || {},
        fieldMappings: data.fieldMappings || {},
        metadata: data.metadata || {},
      },
    });
  }

  static async findById(id: string): Promise<PrismaTemplate | null> {
    return await prisma.template.findUnique({
      where: { id },
    });
  }

  static async findAll(filters?: {
    userId?: string;
    vendorName?: string;
    templateType?: string;
    language?: string;
    isActive?: boolean;
  }): Promise<PrismaTemplate[]> {
    return await prisma.template.findMany({
      where: filters,
      orderBy: [
        { successRate: 'desc' },
        { usageCount: 'desc' },
      ],
    });
  }

  static async update(id: string, data: UpdateTemplateInput): Promise<PrismaTemplate> {
    return await prisma.template.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string): Promise<PrismaTemplate> {
    return await prisma.template.delete({
      where: { id },
    });
  }

  static async findByVendor(vendorName: string, userId: string): Promise<PrismaTemplate[]> {
    return await prisma.template.findMany({
      where: {
        vendorName,
        userId,
        isActive: true,
      },
      orderBy: { successRate: 'desc' },
    });
  }

  static async incrementUsage(id: string): Promise<PrismaTemplate> {
    return await prisma.template.update({
      where: { id },
      data: {
        usageCount: {
          increment: 1,
        },
      },
    });
  }

  static async updateSuccessRate(id: string, successRate: number): Promise<PrismaTemplate> {
    return await prisma.template.update({
      where: { id },
      data: { successRate },
    });
  }
}

export default TemplateModel;
