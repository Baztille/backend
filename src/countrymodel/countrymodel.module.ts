import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ChatModule } from "src/chat/chat.module";
import forFeatureDb from "src/common/database/for-feature.db";
import { CountrymodelController } from "./countrymodel.controller";
import { CountrymodelService } from "./countrymodel.service";

@Module({
  imports: [MongooseModule.forFeature(forFeatureDb), ChatModule],
  exports: [CountrymodelService],
  controllers: [CountrymodelController],
  providers: [CountrymodelService]
})
export class CountrymodelModule {}
