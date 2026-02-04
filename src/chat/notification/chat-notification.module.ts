import { Module } from "@nestjs/common";
import { FirebaseModule } from "src/common/firebase/firebase.module";
import { DeviceTokenModule } from "src/profile/user/device-token.module";
import { ChatNotificationService } from "./chat-notification.service";

@Module({
  imports: [FirebaseModule, DeviceTokenModule],
  providers: [ChatNotificationService],
  exports: [ChatNotificationService]
})
export class ChatNotificationModule {}
