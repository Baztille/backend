import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AiModule } from "src/ai/ai.module";
import { ChatModule } from "src/chat/chat.module";
import forFeatureDb from "src/common/database/for-feature.db";
import { EmailModule } from "src/common/email/email.module";
import { GlobalsModule } from "src/common/globals/globals.module";
import { CountrymodelModule } from "src/countrymodel/countrymodel.module";
import { UserModule } from "src/profile/user/user.module";
import { StatusModule } from "src/status/status.module";
import { VotingSessionModule } from "../voting-session/voting-session.module";
import { DecisionController } from "./decision.controller";
import { DecisionService } from "./decision.service";

@Module({
  imports: [
    MongooseModule.forFeature(forFeatureDb),
    VotingSessionModule,
    ChatModule,
    AiModule,
    EmailModule,
    GlobalsModule,
    StatusModule,
    CountrymodelModule,
    UserModule
  ],
  controllers: [DecisionController],
  providers: [DecisionService],
  exports: [DecisionService]
})
export class DecisionModule {}
