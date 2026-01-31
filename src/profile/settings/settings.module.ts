import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";

import { CommonServicesModule } from "src/common/common-services/common-services.module";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { EmailModule } from "src/common/email/email.module";
import { UserModule } from "../user/user.module";

@Module({
  imports: [MongooseModule.forFeature(forFeatureDb), CommonServicesModule, EmailModule, UserModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService]
})
export class SettingsModule {}
