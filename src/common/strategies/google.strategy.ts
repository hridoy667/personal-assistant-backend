import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from 'src/modules/prisma/prisma.service'; // আপনার প্রিজমা সার্ভিসের সঠিক পাথটি দিন

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService, // ১. প্রিজমা সার্ভিস ইনজেক্ট করা হলো
  ) {
    super({
      clientID: configService.get<string>('CLIENT_ID')!,
      clientSecret: configService.get<string>('CLIENT_SECRET')!,
      callbackURL: configService.get<string>('CALLBACK_URL')!,
      scope: ['email', 'profile'],
      passReqToCallback: false,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails, photos } = profile;
    const email = emails[0].value;

    let user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: email,
          name: `${name.givenName} ${name.familyName}`,
          isProfileComplete: false,
        },
      });
      console.log('New OAuth user registered partially:', email);
    } else {
      console.log('Existing OAuth user logged in:', email);
    }
    const authUser = {
      ...user,
      accessToken,
    };

    done(null, authUser);
  }
}