import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";
import { AiModule } from "../ai/ai.module";
import { EventModule } from "../event/event.module";
import { DecisionModule } from "../vote/decision/decision.module";
import { DebateArgumentService } from "./debate-argument.service";
import { DebateContextService } from "./debate-context.service";
import { DebateController } from "./debate.controller";
import { DebateService } from "./debate.service";

@Module({
  imports: [HttpModule, MongooseModule.forFeature(forFeatureDb), DecisionModule, AiModule, EventModule],
  controllers: [DebateController],
  providers: [DebateService, DebateContextService, DebateArgumentService],
  exports: [DebateService, DebateContextService, DebateArgumentService]
})
export class DebateModule {}
