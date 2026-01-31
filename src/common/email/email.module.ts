import { Module } from "@nestjs/common";
import { EmailService } from "./email.service";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "../database/for-feature.db";
import { UserModule } from "src/profile/user/user.module";

@Module({
  imports: [MongooseModule.forFeature(forFeatureDb)],
  providers: [EmailService],
  exports: [EmailService]
})
export class EmailModule {}
