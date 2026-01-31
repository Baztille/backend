import { HttpModule } from "@nestjs/axios";
import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import forFeatureDb from "src/common/database/for-feature.db";
import { FirebaseModule } from "src/common/firebase/firebase.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";
import { MatrixNotifierController } from "./matrix-notifier.controller";

@Module({
  imports: [HttpModule, MongooseModule.forFeature(forFeatureDb), FirebaseModule],
  exports: [ChatService],
  controllers: [ChatController, MatrixNotifierController],
  providers: [ChatService]
})
export class ChatModule {}
