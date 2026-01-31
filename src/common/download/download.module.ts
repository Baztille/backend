import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "../database/for-feature.db";
import { DownloadService } from "./download.service";

@Module({
  imports: [MongooseModule.forFeature(forFeatureDb)],
  providers: [DownloadService],
  exports: [DownloadService]
})
export class DownloadModule {}
