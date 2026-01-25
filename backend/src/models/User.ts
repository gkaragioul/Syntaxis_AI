import { prisma } from '../prisma';
import { User as PrismaUser } from '@prisma/client';

export type User = PrismaUser;

// Wrapper for Prisma-based user operations to replace old pg-based UserModel
export class UserModel {
  static async findById(id: string) {
    return prisma.user.findUnique({
      where: { id }
    });
  }
  static async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email }
    });
  }
  // Add other methods as needed by the app
}

export default UserModel;
