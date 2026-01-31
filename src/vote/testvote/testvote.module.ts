import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";
import { TestVoteController } from "./testvote.controller";
import { TestVoteService } from "./testvote.service";
import { DecisionModule } from "../decision/decision.module";
import { VotingSessionMongo } from "../voting-session/voting-session.schema";
import { VotingSessionModule } from "../voting-session/voting-session.module";
import { DebateContextMongo } from "src/debate/debate.schema";
import { DebateModule } from "src/debate/debate.module";

@Module({
  imports: [MongooseModule.forFeature(forFeatureDb), DecisionModule, VotingSessionModule, DebateModule],
  controllers: [TestVoteController],
  providers: [TestVoteService]
})
export class TestVoteModule {}
