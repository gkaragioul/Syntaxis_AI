import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';

@Injectable()
export class SessionService {
  private readonly refreshTokenExpiry: number;
  private readonly maxConcurrentSessions: number;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    this.refreshTokenExpiry = this.configService.get<number>(
      'JWT_REFRESH_EXPIRY',
      7 * 24 * 60 * 60,
    ); // 7 days in seconds
    this.maxConcurrentSessions = this.configService.get<number>(
      'MAX_CONCURRENT_SESSIONS',
      3,
    );
  }

  async createSession(
    userId: string,
    deviceInfo: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Check concurrent sessions limit
    const activeSessions = await this.prisma.session.count({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
    });

    if (activeSessions >= this.maxConcurrentSessions) {
      // Remove oldest session
      const oldestSession = await this.prisma.session.findFirst({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      if (oldestSession) {
        await this.prisma.session.delete({ where: { id: oldestSession.id } });
      }
    }

    // Generate tokens
    const accessToken = this.generateAccessToken(userId);
    const refreshToken = this.generateRefreshToken();

    // Create session record
    await this.prisma.session.create({
      data: {
        userId,
        refreshToken,
        deviceInfo,
        expiresAt: new Date(Date.now() + this.refreshTokenExpiry * 1000),
      },
    });

    return { accessToken, refreshToken };
  }

  async refreshSession(
    refreshToken: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const session = await this.prisma.session.findFirst({
      where: { refreshToken },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    // Generate new tokens
    const newAccessToken = this.generateAccessToken(session.userId);
    const newRefreshToken = this.generateRefreshToken();

    // Update session
    await this.prisma.session.update({
      where: { id: session.id },
      data: {
        refreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + this.refreshTokenExpiry * 1000),
        lastUsedAt: new Date(),
      },
    });

    return { accessToken: newAccessToken, refreshToken: newRefreshToken };
  }

  async invalidateSession(refreshToken: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { refreshToken },
    });
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    await this.prisma.session.deleteMany({
      where: { userId },
    });
  }

  async getUserSessions(userId: string): Promise<any[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastUsedAt: 'desc' },
      select: {
        id: true,
        deviceInfo: true,
        createdAt: true,
        lastUsedAt: true,
        expiresAt: true,
      },
    });
  }

  async cleanupExpiredSessions(): Promise<void> {
    await this.prisma.session.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }

  private generateAccessToken(userId: string): string {
    const payload = { sub: userId };
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: this.configService.get<string>('JWT_EXPIRY', '15m'),
    });
  }

  private generateRefreshToken(): string {
    return require('crypto').randomBytes(40).toString('hex');
  }
}
