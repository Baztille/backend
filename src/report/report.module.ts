import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";
import { ReportController } from "./report.controller";
import { ReportService } from "./report.service";

@Module({
  imports: [MongooseModule.forFeature(forFeatureDb)],
  controllers: [ReportController],
  providers: [ReportService]
})
export class ReportModule {}
