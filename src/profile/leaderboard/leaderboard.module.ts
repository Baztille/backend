import { Module } from "@nestjs/common";
import { LeaderboardService } from "./leaderboard.service";
import { LeaderboardController } from "./leaderboard.controller";
import { CommonServicesModule } from "src/common/common-services/common-services.module";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";
import { UserModule } from "../user/user.module";
import { CacheModule } from "@nestjs/cache-manager";

export const USERS_COLLECTION = "USERS_COLLECTION";

@Module({
  controllers: [LeaderboardController],
  imports: [MongooseModule.forFeature(forFeatureDb), CommonServicesModule, UserModule, CacheModule.register()],
  providers: [LeaderboardService],
  exports: [LeaderboardService]
})
export class LeaderboardModule {}
