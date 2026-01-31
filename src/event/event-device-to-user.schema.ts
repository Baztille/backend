import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";
import { TrackEventCategory, TrackEventType, PlatformType } from "src/event/event-types";

export type EventDeviceToUserDocument = HydratedDocument<EventDeviceToUserMongo>;

//
// Device to User Event Schema
// Associate a device to a user at login/registration time
// Then, a cronjob use documents in this collection to retroactively link events to the user using deviceId
// After processing, documents are deleted from this collection
//

@Schema({ collection: "e_device_to_user" })
export class EventDeviceToUserMongo {
  _id: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true
  })
  userId: string;

  @Prop({
    type: String,
    required: true,
    trim: true
  })
  deviceId: string;

  // Login/register timestamp
  @Prop({
    type: Number,
    required: false,
    index: true
  })
  timestamp?: number;
}

export const EventDeviceToUserSchema = SchemaFactory.createForClass(EventDeviceToUserMongo);
