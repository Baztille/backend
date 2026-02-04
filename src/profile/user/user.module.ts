import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { ChatModule } from "src/chat/chat.module";
import { CommonServicesModule } from "src/common/common-services/common-services.module";
import forFeatureDb from "src/common/database/for-feature.db";
import { EmailModule } from "src/common/email/email.module";
import { GlobalsModule } from "src/common/globals/globals.module";
import { CountrymodelModule } from "src/countrymodel/countrymodel.module";
import { EventModule } from "src/event/event.module";
import { DeviceTokenModule } from "./device-token.module";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";

@Module({
  imports: [
    MongooseModule.forFeature(forFeatureDb),
    CommonServicesModule,
    CountrymodelModule,
    ChatModule,
    EmailModule,
    GlobalsModule,
    EventModule,
    DeviceTokenModule
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService]
})
export class UserModule {}
