import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import { createHash } from 'crypto';

export const REFRESH_TOKEN_PREFIX = 'refresh_token:';
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export function getRefreshTokenKey(userId: string): string {
  return `${REFRESH_TOKEN_PREFIX}${userId}`;
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function getRefreshTokenSecret(): string {
  return (
    process.env.JWT_REFRESH_SECRET ||
    process.env.JWT_SECRET ||
    'your-fallback-secret'
  );
}

export function signAccessToken(
  jwtService: JwtService,
  payload: Record<string, unknown>,
): string {
  return jwtService.sign(payload, { expiresIn: '12h' });
}

export function signRefreshToken(
  jwtService: JwtService,
  payload: Record<string, unknown>,
): string {
  return jwtService.sign(payload, {
    expiresIn: '7d',
    secret: getRefreshTokenSecret(),
  });
}

export async function saveRefreshToken(
  redis: Redis,
  userId: string,
  refreshToken: string,
): Promise<void> {
  const tokenHash = hashToken(refreshToken);
  await redis.set(
    getRefreshTokenKey(userId),
    tokenHash,
    'EX',
    REFRESH_TOKEN_TTL_SECONDS,
  );
}

export async function removeRefreshToken(
  redis: Redis,
  userId: string,
): Promise<void> {
  await redis.del(getRefreshTokenKey(userId));
}

export function verifyRefreshToken(
  jwtService: JwtService,
  refreshToken: string,
): any {
  return jwtService.verify(refreshToken, {
    secret: getRefreshTokenSecret(),
  });
}

export async function validateRefreshToken(
  redis: Redis,
  jwtService: JwtService,
  refreshToken: string,
): Promise<{ sub: string } | null> {
  try {
    const payload = verifyRefreshToken(jwtService, refreshToken) as {
      sub: string;
    };
    const storedHash = await redis.get(getRefreshTokenKey(payload.sub));
    if (!storedHash) return null;

    const tokenHash = hashToken(refreshToken);
    if (storedHash !== tokenHash) return null;

    return payload;
  } catch {
    return null;
  }
}
