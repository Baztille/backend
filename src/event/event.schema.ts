import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";
import { TrackEventCategory, TrackEventType, PlatformType } from "src/event/event-types";

export type EventDocument = HydratedDocument<EventMongo>;

@Schema({ collection: "event" })
export class EventMongo {
  // Event category (e.g., 'user', 'vote', 'chat', 'debug')
  @Prop({
    type: String,
    required: true,
    trim: true,
    index: true
  })
  category: TrackEventCategory;

  // Event type (e.g., 'login', 'logout', 'vote_cast', 'message_sent')
  @Prop({
    type: String,
    required: true,
    trim: true,
    index: true
  })
  type: TrackEventType;

  // Event data (flexible object to store event-specific data)
  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: false,
    default: {}
  })
  eventdata: any;

  // User ID who triggered the event (optional for external events)
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: false,
    index: true
  })
  userId?: string;

  // Device ID (for mobile tracking)
  @Prop({
    type: String,
    required: false,
    trim: true,
    index: true
  })
  deviceId?: string;

  // Platform (ios or android)
  @Prop({
    type: String,
    required: false,
    trim: true,
    enum: Object.values(PlatformType),
    index: true
  })
  platform?: PlatformType;

  // App version
  @Prop({
    type: String,
    required: false,
    trim: true,
    index: true
  })
  appVersion?: string;

  // Event timestamp
  @Prop({
    type: Number,
    required: true,
    index: true
  })
  timestamp: number;
}

export const EventSchema = SchemaFactory.createForClass(EventMongo);

// Add compound indexes for common queries
EventSchema.index({ category: 1, type: 1 });
EventSchema.index({ userId: 1, timestamp: -1 });
EventSchema.index({ deviceId: 1, timestamp: -1 });
