// @ts-nocheck

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { rateLimiter } from '../middleware/rateLimiter';
import { DataDeletionService } from '../services/DataDeletionService';
import { logger } from '../utils/logger';

const router = Router();
const deletionService = new DataDeletionService();

// Start the deletion worker
deletionService.startDeletionWorker().catch((error) => {
  logger.error('Failed to start deletion worker', { error });
});

router.post(
  '/delete-account',
  authMiddleware,
  rateLimiter,
  async (req, res) => {
    try {
      const request = await deletionService.requestDeletion(req.user!.id);
      res.json({
        message: 'Account deletion request received',
        requestId: request.id,
        estimatedCompletion: 'within 48 hours',
      });
    } catch (error) {
      logger.error('Failed to request account deletion', {
        error,
        userId: req.user!.id,
      });
      res.status(500).json({
        error: 'Failed to process account deletion request',
      });
    }
  },
);

router.get(
  '/delete-account/status/:requestId',
  authMiddleware,
  rateLimiter,
  async (req, res) => {
    try {
      const request = await deletionService.getDeletionStatus(
        req.params.requestId,
      );
      if (!request) {
        return res.status(404).json({
          error: 'Deletion request not found',
        });
      }

      // Ensure user can only check their own deletion requests
      if (request.userId !== req.user!.id) {
        return res.status(403).json({
          error: 'Unauthorized to view this deletion request',
        });
      }

      res.json(request);
    } catch (error) {
      logger.error('Failed to get deletion status', {
        error,
        requestId: req.params.requestId,
      });
      res.status(500).json({
        error: 'Failed to get deletion request status',
      });
    }
  },
);

router.get('/privacy-policy', (req, res) => {
  res.json({
    version: '1.0',
    lastUpdated: '2024-03-20',
    content: {
      dataCollection: {
        title: 'Data Collection',
        description:
          'We collect and process your data to provide our PDF extraction services. This includes:',
        items: [
          'PDF files you upload for processing',
          'Extracted data and tables from your documents',
          'Account information (name, email, license details)',
          'Usage data to improve our services',
        ],
      },
      dataProtection: {
        title: 'Data Protection',
        description: 'Your data is protected through:',
        items: [
          'End-to-end encryption for all data transfers',
          'Encryption at rest for stored files and data',
          'Secure cloud storage with AWS S3',
          'Regular security audits and updates',
        ],
      },
      dataUsage: {
        title: 'Data Usage',
        description: 'We use your data to:',
        items: [
          'Process your PDF extraction requests',
          'Improve our extraction algorithms',
          'Provide customer support',
          'Send important service notifications',
        ],
      },
      dataRetention: {
        title: 'Data Retention',
        description: 'We retain your data:',
        items: [
          'Until you request deletion',
          'For up to 30 days after account deletion (for backup purposes)',
          'As required by law or for legal compliance',
        ],
      },
      userRights: {
        title: 'Your Rights',
        description: 'You have the right to:',
        items: [
          'Access your personal data',
          'Request data correction',
          'Request data deletion',
          'Export your data',
          'Opt out of non-essential communications',
        ],
      },
    },
  });
});

router.get('/security-info', (req, res) => {
  res.json({
    version: '1.0',
    lastUpdated: '2024-03-20',
    content: {
      encryption: {
        title: 'Data Encryption',
        description:
          'We use industry-standard encryption to protect your data:',
        items: [
          'TLS 1.3 for all data in transit',
          'AES-256 encryption for data at rest',
          'Secure key management through AWS KMS',
          'Regular encryption key rotation',
        ],
      },
      accessControl: {
        title: 'Access Control',
        description: 'We implement strict access controls:',
        items: [
          'Multi-factor authentication for admin access',
          'Role-based access control',
          'Session management and timeout',
          'IP-based access restrictions',
        ],
      },
      monitoring: {
        title: 'Security Monitoring',
        description: 'We continuously monitor our systems:',
        items: [
          '24/7 security monitoring',
          'Automated threat detection',
          'Regular security audits',
          'Incident response procedures',
        ],
      },
      compliance: {
        title: 'Compliance',
        description: 'We maintain compliance with:',
        items: [
          'GDPR requirements',
          'Data protection regulations',
          'Industry security standards',
          'Regular compliance audits',
        ],
      },
    },
  });
});

export default router;
