import { Module } from "@nestjs/common";
import { StatusController } from "./status.controller";
import { StatusService } from "./status.service";
import { HttpModule } from "@nestjs/axios";
import { CronProvider } from "src/cron-job/cron.provider";
import { CronModule } from "src/cron-job/cron.module";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";

@Module({
  imports: [HttpModule, MongooseModule.forFeature(forFeatureDb)],
  controllers: [StatusController],
  providers: [StatusService],
  exports: [StatusService]
})
export class StatusModule {}
