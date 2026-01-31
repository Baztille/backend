import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { MongooseModule } from "@nestjs/mongoose";
import { PassportModule } from "@nestjs/passport";
import { FileUploadService } from "src/common/common-services/file-upload.service";
import { DatabaseModule } from "src/common/database/database.module";
import forFeatureDb from "src/common/database/for-feature.db";
import { EmailService } from "src/common/email/email.service";
import { UserService } from "src/profile/user/user.service";
import { JwtStrategy } from "../strategy/jwt.strategy";
import { RefreshStrategy } from "../strategy/refresh.strategy";
import { ResetPasswordStrategy } from "../strategy/reset-password.strategy";
import { AuthController } from "./auth.controller";
import { AuthProvider } from "./auth.provider";
import { AuthService } from "./auth.service";
import { UserModule } from "src/profile/user/user.module";
import { EmailModule } from "src/common/email/email.module";
import { CacheModule } from "@nestjs/cache-manager";
import { EventModule } from "src/event/event.module";
@Module({
  imports: [
    CacheModule.register(),
    DatabaseModule,
    UserModule,
    EmailModule,
    EventModule,
    PassportModule.register({ defaultStrategy: ["jwt"] }),
    JwtModule.register({
      secret: process.env.JWT_SECRET_KEY
    }),
    MongooseModule.forFeature(forFeatureDb)
  ],
  providers: [AuthService, JwtStrategy, ...AuthProvider, RefreshStrategy, ResetPasswordStrategy, FileUploadService],
  controllers: [AuthController],
  exports: [AuthService, ...AuthProvider]
})
export class AuthModule {}
