/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  type?: string;
  name: string;
  avatarUrl: string | null;
  district: string;
  timzone?: string;
  latitude: number | null;
  longitude: number | null;
  enableIslamicFeatures?: boolean;
  enableMailAssistance?: boolean;
  enableFinanceTracker?: boolean;
  enableHealthTracking?: boolean;
  enableScreenTimeTracking?: boolean;
  enableAiBriefings?: boolean;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-fallback-secret',
    });
  }

  validate(payload: JwtPayload) {
    return {
      userId: payload.sub,
      type: payload.type,
      name: payload.name,
      avatarUrl: payload.avatarUrl,
      district: payload.district,
      timezone: payload.timzone,
      latitude: payload.latitude,
      longitude: payload.longitude,
      enableIslamicFeatures: payload.enableIslamicFeatures,
      enableMailAssistance: payload.enableMailAssistance,
      enableFinanceTracker: payload.enableFinanceTracker,
      enableHealthTracking: payload.enableHealthTracking,
      enableScreenTimeTracking: payload.enableScreenTimeTracking,
      enableAiBriefings: payload.enableAiBriefings,
    };
  }
}