// @ts-nocheck

import { prisma } from '../prisma';

export type LicenseType = 'trial' | 'subscription' | 'lifetime';
export type LicenseStatus = 'active' | 'expired' | 'revoked';

export interface License {
  id: string;
  license_key: string;
  type: LicenseType;
  status: LicenseStatus;
  user_id?: string;
  max_devices: number;
  activated_devices: number;
  valid_from: Date;
  valid_until?: Date;
  created_at: Date;
  updated_at: Date;
  revoked_at?: Date;
}

export const LicenseModel = {
  findById: async (id: string) => {
    return prisma.license.findUnique({
      where: { id }
    });
  },
  findByLicenseKey: async (key: string) => {
    return prisma.license.findUnique({
      where: { key }
    });
  },
  findByUserId: async (userId: string) => {
    return prisma.license.findMany({
      where: { userId }
    });
  },
  isLicenseValid: (license: any) => {
    if (license.status !== 'active') return false;
    if (license.expiresAt && new Date(license.expiresAt) < new Date()) return false;
    return true;
  },
  canActivateDevice: (license: any) => {
    // Check devices count in Prisma
    return true; // Simplified for now
  }
};

export default LicenseModel;
