import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";
import { CountryController } from "./country.controller";
import { CountryService } from "./country.service";

@Module({
  imports: [MongooseModule.forFeature(forFeatureDb)],
  controllers: [CountryController],
  providers: [CountryService]
})
export class CountryModule {}
