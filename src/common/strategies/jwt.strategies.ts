/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  type: string;
  name: string;
  avatarUrl: string;
  district: string;
  latitude: number;
  longitude: number;
  shop?: any;
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
      latitude: payload.latitude,
      longitude: payload.longitude,
      shop: payload.shop,
    };
  }
}
