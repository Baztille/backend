import { Global, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";
import { UserController } from "./user.controller";
import { UserService } from "./user.service";
import { CommonServicesModule } from "src/common/common-services/common-services.module";
import { CountrymodelModule } from "src/countrymodel/countrymodel.module";
import { ChatModule } from "src/chat/chat.module";
import { EmailModule } from "src/common/email/email.module";
import { GlobalsModule } from "src/common/globals/globals.module";
import { EventModule } from "src/event/event.module";

@Module({
  imports: [
    MongooseModule.forFeature(forFeatureDb),
    CommonServicesModule,
    CountrymodelModule,
    ChatModule,
    EmailModule,
    GlobalsModule,
    EventModule
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService]
})
export class UserModule {}
