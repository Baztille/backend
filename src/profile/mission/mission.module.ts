import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";

import { CommonServicesModule } from "src/common/common-services/common-services.module";
import { MissionController } from "./mission.controller";
import { MissionService } from "./mission.service";
import { EmailModule } from "src/common/email/email.module";
import { GlobalsModule } from "src/common/globals/globals.module";
import { UserModule } from "../user/user.module";
import { ChatModule } from "src/chat/chat.module";
import { EventModule } from "src/event/event.module";

@Module({
  imports: [
    MongooseModule.forFeature(forFeatureDb),
    CommonServicesModule,
    EmailModule,
    ChatModule,
    GlobalsModule,
    UserModule,
    EventModule
  ],
  controllers: [MissionController],
  providers: [MissionService],
  exports: [MissionService]
})
export class MissionModule {}
