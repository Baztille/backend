import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { AuthService } from "../auth/auth.service";
@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, "refresh") {
  constructor(private readonly authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.REFRESH_SECRET_KEY
    });
  }
  async validate(payload) {
    const user = await this.authService.getUserByMail(payload.email);

    if (!user) {
      throw new UnauthorizedException("User not found");
    }
    return user;
  }
}
