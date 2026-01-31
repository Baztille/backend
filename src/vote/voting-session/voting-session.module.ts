import { Module } from "@nestjs/common";
import { VotingSessionController } from "./voting-session.controller";
import { VotingSessionService } from "./voting-session.service";
import { CountrymodelModule } from "src/countrymodel/countrymodel.module";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";
import { StatusModule } from "src/status/status.module";
import { EventModule } from "src/event/event.module";

@Module({
  imports: [CountrymodelModule, MongooseModule.forFeature(forFeatureDb), StatusModule, EventModule],
  controllers: [VotingSessionController],
  providers: [VotingSessionService],
  exports: [VotingSessionService]
})
export class VotingSessionModule {}
