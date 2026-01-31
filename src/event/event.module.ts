import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";
import { EventController } from "./event.controller";
import { EventService } from "./event.service";

import { CommonServicesModule } from "src/common/common-services/common-services.module";
import { GlobalsModule } from "src/common/globals/globals.module";

@Module({
  imports: [MongooseModule.forFeature(forFeatureDb), CommonServicesModule, GlobalsModule],
  controllers: [EventController],
  providers: [EventService],
  exports: [EventService]
})
export class EventModule {}
