// @ts-nocheck

import { prisma } from '../prisma';

export interface Device {
  id: string;
  license_id: string;
  user_id: string;
  device_fingerprint: string;
  device_name?: string;
  device_type?: string;
  browser_info?: Record<string, any>;
  ip_address?: string;
  is_active: boolean;
  last_active_at?: Date;
  activated_at: Date;
  deactivated_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export const DeviceModel = {
  findById: async (id: string) => {
    return prisma.device.findUnique({
      where: { id }
    });
  },
  findByFingerprint: async (fingerprint: string) => {
    return prisma.device.findFirst({
      where: { fingerprint, status: 'active' }
    });
  },
  update: async (id: string, data: any) => {
    return prisma.device.update({
      where: { id },
      data
    });
  },
  deactivate: async (id: string) => {
    return prisma.device.update({
      where: { id },
      data: { status: 'inactive', deactivatedAt: new Date() }
    });
  },
  updateLastActive: async (id: string) => {
    return prisma.device.update({
      where: { id },
      data: { lastSeenAt: new Date() }
    });
  }
};

export default DeviceModel;
