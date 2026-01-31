import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "../database/for-feature.db";
import { SmsController } from "./sms.controller";
import { SmsService } from "./sms.service";
import { UserModule } from "src/profile/user/user.module";

@Module({
  imports: [UserModule, MongooseModule.forFeature(forFeatureDb)],
  controllers: [SmsController],
  providers: [SmsService],
  exports: [SmsService]
})
export class SmsModule {}
