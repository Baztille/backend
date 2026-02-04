import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

export type DeviceTokenDocument = HydratedDocument<DeviceTokenMongo>;

@Schema({ collection: "u_device_tokens", timestamps: true })
export class DeviceTokenMongo {
  _id: string;

  // FCM registration token (pushkey)
  @Prop({
    type: String,
    required: true,
    unique: true,
    index: true
  })
  token: string;

  // User owning this token
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    index: true,
    ref: "UserMongo"
  })
  userId: string;

  // Device UUID (same as users.devices key)
  @Prop({
    type: String,
    required: true,
    index: true
  })
  deviceId: string;

  // Timestamps (auto-managed by Mongoose)
  createdAt: Date;
  updatedAt: Date;

  // Invalidation tracking
  @Prop({
    type: Date,
    required: false,
    index: true // Index for quick filtering of invalid tokens
  })
  invalidAt?: Date;

  @Prop({
    type: String,
    required: false
  })
  invalidReason?: string; // Firebase error code (e.g., "messaging/registration-token-not-registered")

  // Success tracking
  @Prop({
    type: Date,
    required: false
  })
  lastSuccessAt?: Date;

  // Error tracking
  @Prop({
    type: Date,
    required: false
  })
  lastErrorAt?: Date;

  @Prop({
    type: String,
    required: false
  })
  lastErrorMessage?: string;
}

export const DeviceTokenSchema = SchemaFactory.createForClass(DeviceTokenMongo);

// Compound index for user + device lookup
DeviceTokenSchema.index({ userId: 1, deviceId: 1 });
