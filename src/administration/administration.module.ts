import { Module } from "@nestjs/common";
import { AdministrationController } from "./administration.controller";
import { AdministrationService } from "./administration.service";
import { HttpModule } from "@nestjs/axios";
import { CronProvider } from "src/cron-job/cron.provider";
import { CronModule } from "src/cron-job/cron.module";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";

@Module({
  imports: [HttpModule, CronModule, MongooseModule.forFeature(forFeatureDb)],
  controllers: [AdministrationController],
  providers: [AdministrationService],
  exports: [AdministrationService]
})
export class AdministrationModule {}
