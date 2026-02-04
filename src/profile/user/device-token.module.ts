import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { DeviceTokenMongo, DeviceTokenSchema } from "./device-token.schema";
import { DeviceTokenService } from "./device-token.service";
import { UserMongo, UserSchema } from "./user.schema";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: DeviceTokenMongo.name, schema: DeviceTokenSchema },
      { name: UserMongo.name, schema: UserSchema }
    ])
  ],
  providers: [DeviceTokenService],
  exports: [DeviceTokenService]
})
export class DeviceTokenModule {}
