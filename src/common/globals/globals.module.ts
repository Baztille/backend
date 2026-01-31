import { Module } from "@nestjs/common";
import { GlobalsService } from "./globals.service";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "../database/for-feature.db";

@Module({
  imports: [MongooseModule.forFeature(forFeatureDb)],
  providers: [GlobalsService],
  exports: [GlobalsService]
})
export class GlobalsModule {}
