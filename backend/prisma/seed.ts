import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  await prisma.$transaction([
    prisma.device.deleteMany(),
    prisma.license.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.errorReport.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.templateApplication.deleteMany(),
    prisma.template.deleteMany(),
    prisma.ocrResult.deleteMany(),
    prisma.extraction.deleteMany(),
    prisma.file.deleteMany(),
    prisma.fieldPattern.deleteMany(),
    prisma.extractionRule.deleteMany(),
    prisma.batchJob.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // Create test users
  const adminPassword = await hash('admin123', 12);
  const userPassword = await hash('user123', 12);

  const admin = await prisma.user.create({
    data: {
      email: 'admin@syntaxis.ai',
      passwordHash: adminPassword,
      subscriptionStatus: 'premium',
      monthlyLimit: 1000,
      emailVerified: true,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: 'user@syntaxis.ai',
      passwordHash: userPassword,
      subscriptionStatus: 'free',
      monthlyLimit: 3,
      emailVerified: true,
    },
  });

  // Create test templates
  const template = await prisma.template.create({
    data: {
      userId: admin.id,
      name: 'Standard Invoice Template',
      vendorName: 'Example Corp',
      patterns: {
        vendorName: ['Example Corp', 'Example Corporation'],
        invoiceNumber: ['INV-\\d{6}', 'Invoice #\\d{6}'],
        totalAmount: ['Total: \\$\\d+\\.\\d{2}', 'Amount Due: \\$\\d+\\.\\d{2}'],
      },
      fieldMappings: {
        vendorName: { type: 'text', required: true },
        invoiceNumber: { type: 'text', required: true },
        totalAmount: { type: 'currency', required: true },
      },
      successRate: 0.95,
      usageCount: 0,
    },
  });

  // Create test field patterns
  await prisma.fieldPattern.create({
    data: {
      userId: admin.id,
      field: 'vendorName',
      patterns: ['Example Corp', 'Example Corporation', 'Example Inc'],
      priority: 1,
    },
  });

  // Create test extraction rules
  await prisma.extractionRule.create({
    data: {
      userId: admin.id,
      field: 'totalAmount',
      validation: {
        type: 'currency',
        min: 0,
        max: 1000000,
        required: true,
      },
      confidence: 0.9,
    },
  });

  // Create test batch job
  const batchJob = await prisma.batchJob.create({
    data: {
      userId: admin.id,
      status: 'completed',
      totalFiles: 5,
      processedFiles: 5,
      failedFiles: 0,
    },
  });

  // Create test notifications
  await prisma.notification.create({
    data: {
      userId: admin.id,
      batchJobId: batchJob.id,
      type: 'status',
      status: 'completed',
      message: 'Batch processing completed successfully',
      metadata: {
        processedFiles: 5,
        failedFiles: 0,
        totalTime: '2m 30s',
      },
    },
  });

  // Create test audit log
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'login',
      resourceType: 'user',
      resourceId: admin.id,
      metadata: {
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      },
      ipAddress: '127.0.0.1',
      userAgent: 'Mozilla/5.0',
    },
  });

  // Create test license
  const license = await prisma.license.create({
    data: {
      userId: admin.id,
      key: 'TEST-LICENSE-KEY-123',
      status: 'active',
      type: 'premium',
      maxDevices: 5,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    },
  });

  // Create test device
  await prisma.device.create({
    data: {
      licenseId: license.id,
      deviceInfo: 'Test Device',
      fingerprint: 'test-device-fingerprint',
      status: 'active',
    },
  });

  console.log('Database seeded successfully!');
  console.log('Admin user created:', admin.email);
  console.log('Regular user created:', user.email);
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 