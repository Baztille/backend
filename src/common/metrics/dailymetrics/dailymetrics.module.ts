// src/common/metrics/prometheus.module.ts
import { Module } from "@nestjs/common";
import { DailyMetricsController } from "./dailymetrics.controller";
import { DailyMetricsService } from "./dailymetrics.service";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";
import { EmailModule } from "src/common/email/email.module";

@Module({
  imports: [MongooseModule.forFeature(forFeatureDb), EmailModule],
  controllers: [DailyMetricsController],
  providers: [DailyMetricsService],
  exports: [DailyMetricsService]
})
export class DailyMetricsModule {}
