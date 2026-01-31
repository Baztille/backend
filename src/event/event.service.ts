import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EventMongo, EventDocument } from "./event.schema";
import { CreateEventDto } from "./dto/create-event.dto";
import { getCurrentDate } from "src/utils/date-time";
import { cronlogDebug, cronlogError, cronlogInfo, logDebug, logError, logInfo } from "src/utils/logger";
import { PostHog } from "posthog-node";
import { createHash } from "crypto";

import { PlatformType, TrackEventCategory, TrackEventType, TrackEventTypesDetails } from "src/event/event-types";
import { ClsService } from "nestjs-cls";
import { EventDeviceToUserMongo, EventDeviceToUserDocument } from "./event-device-to-user.schema";
import { GlobalsService } from "src/common/globals/globals.service";
import { GlobalKey } from "src/common/globals/globals.enum";
import { cron } from "@sentry/nestjs";
import { last } from "rxjs";

type EventContext = { userId: string; deviceId: string; platform: string; appVersion: string };

@Injectable()
export class EventService {
  constructor(
    @InjectModel(EventMongo.name) private eventModel: Model<EventDocument>,
    @InjectModel(EventDeviceToUserMongo.name) private eventDeviceToUserModel: Model<EventDeviceToUserDocument>,
    private readonly cls: ClsService,
    private readonly globalService: GlobalsService
  ) {}

  /**
   * Get current request context (or default values for cronjobs)
   * @returns
   */
  private getContext(): EventContext {
    return {
      userId: this.cls.get("userId") ?? null,
      deviceId: this.cls.get("deviceId") ?? "cron",
      platform: this.cls.get("platform") ?? PlatformType.UNKNOWN,
      appVersion: this.cls.get("appVersion") ?? ""
    };
  }

  /**
   * Create a new event with validation
   * @param createEventDto Event data
   * @param ipAddress Optional IP address
   * @param userAgent Optional user agent
   * @param isExternal Whether this is from external client
   * @returns Created event
   */
  private async _recordEventInDb(createEventDto: CreateEventDto, isExternal = false): Promise<EventDocument> {
    try {
      // Get request context (userId, deviceId, platform, appVersion)
      const { userId, deviceId, platform, appVersion } = this.getContext();

      // Get event category from event type
      const eventTypeDetails = TrackEventTypesDetails[createEventDto.type];
      if (!eventTypeDetails) {
        throw new BadRequestException(`Invalid event type: ${createEventDto.type}`);
      }
      const category = eventTypeDetails.category;

      // Check if external clients are allowed to send this event type
      if (isExternal && TrackEventTypesDetails[createEventDto.type].externalAllowed === false) {
        throw new BadRequestException(`Event type ${createEventDto.type} is not allowed for external clients`);
      }

      // Force a specific userId provided as eventData (if any)
      // (only allowed for internal events)
      let forceUserId = null;
      if (!isExternal && createEventDto.eventdata?.forceUserId) {
        forceUserId = createEventDto.eventdata.forceUserId;
        delete createEventDto.eventdata.forceUserId;
      }

      // Get HTTP request for tracking infos
      const eventData = {
        ...createEventDto,
        category: category,
        userId: forceUserId ? forceUserId : userId,
        deviceId: deviceId,
        platform: platform,
        appVersion: appVersion,
        timestamp: getCurrentDate().getTime() // Ensure timestamp is taken from server time (and not from createEventDto.timestamp)
      };

      logDebug(`Creating event: ${eventData.category}/${eventData.type}`, eventData);

      const createdEvent = new this.eventModel(eventData);
      const savedEvent = await createdEvent.save();

      logInfo(`Event created: ${savedEvent._id} - ${savedEvent.category}/${savedEvent.type}`);

      // If event is a login or registration, create a Device to User record
      // Note: this will be used by a cronjob to retroactively link past events with this deviceId to this user
      if (
        (createEventDto.type === TrackEventType.USER_LOGIN || createEventDto.type === TrackEventType.CREATE_USER) &&
        savedEvent.userId &&
        savedEvent.deviceId
      ) {
        logDebug(`Creating Device to User link for userId=${savedEvent.userId} and deviceId=${savedEvent.deviceId}`);
        const eventDeviceToUser = new this.eventDeviceToUserModel({
          userId: savedEvent.userId,
          deviceId: savedEvent.deviceId,
          timestamp: savedEvent.timestamp
        });
        await eventDeviceToUser.save();
      }

      return savedEvent;
    } catch (error) {
      logError(`Failed to create event: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * Create an event from internal backend operations
   * @param category Event category
   * @param type Event type
   * @param eventdata Event data
   * @param userId Optional user ID
   * @returns Created event
   */
  async trackEvent(type: TrackEventType, eventdata?: any): Promise<EventDocument> {
    const createEventDto: CreateEventDto = {
      type,
      eventdata
    };

    return this._recordEventInDb(createEventDto, false);
  }

  /**
   * Create an event from external backend operations
   * @param category Event category
   * @param type Event type
   * @param eventdata Event data
   * @param userId Optional user ID
   * @returns Created event
   */
  async trackExternalEvent(createEventDto: CreateEventDto): Promise<EventDocument> {
    return this._recordEventInDb(createEventDto, true);
  }

  /**
   * Process user/device linking events
   * Usually run as a cronjob
   * For every document in EventDeviceToUser, link past events with the same deviceId to the userId
   * Then delete the EventDeviceToUser document
   * @returns void
   */
  async processUserDeviceLinkingEvents() {
    // Get all EventDeviceToUser links
    const links = await this.eventDeviceToUserModel.find<EventDeviceToUserMongo>();

    cronlogInfo(`Processing ${links.length} user/device linking events`);

    for (const link of links) {
      cronlogDebug(`Linking events for deviceId=${link.deviceId} to userId=${link.userId}`);

      // Note: update only events where userId is null
      const result = await this.eventModel.updateMany(
        { deviceId: link.deviceId, userId: null },
        { $set: { userId: link.userId } }
      );

      cronlogDebug(`Linked ${result.modifiedCount} events for deviceId=${link.deviceId} to userId=${link.userId}`);

      // Delete the link document
      await this.eventDeviceToUserModel.deleteOne({ _id: link._id });
    }
    logInfo(`Processed ${links.length} user/device linking events`);
  }

  /**
   * Admin function to link past user/device events
   * To be called from an admin endpoint
   * (will be used once, can probably be removed later)
   * @returns void
   */
  async linkPastUserDeviceEvents() {
    // Get all create_user and user_login events
    const events = await this.eventModel.find<EventDocument>({
      type: { $in: [TrackEventType.CREATE_USER, TrackEventType.USER_LOGIN] }
    });

    logInfo(`Linking past user/device events for ${events.length} events`);

    for (const event of events) {
      if (event.userId && event.deviceId && event.deviceId !== "cron") {
        logDebug(`Add device to user entry for deviceId=${event.deviceId} to userId=${event.userId}`);

        // Create EventDeviceToUser entry
        const eventDeviceToUser = new this.eventDeviceToUserModel({
          userId: event.userId,
          deviceId: event.deviceId,
          timestamp: event.timestamp
        });
        await eventDeviceToUser.save();
      }
    }
  }

  /**
   * Upload events to external analytics system
   * Usually run as a cronjob (or admin endpoint)
   */
  async uploadEventsToAnalyticsSystem() {
    cronlogInfo(`Uploading events to external analytics system`);

    // Get last timestamp of the last event sent to analytics
    let lastEventTimestamp = await this.globalService.getGlobal<number>(GlobalKey.LAST_EVENT_SENT_TO_ANALYTICS);

    if (typeof lastEventTimestamp == "undefined") {
      lastEventTimestamp = 0;
    }

    cronlogInfo(`Last event timestamp sent to analytics: ${lastEventTimestamp}`);

    // Get events after lastEventTimestamp
    // Do not get event from the last hour to avoid sending events that will be modified by device/user linking later
    const events = await this.eventModel
      .find<EventDocument>({
        timestamp: { $gt: lastEventTimestamp, $lt: new Date(Date.now() - 60 * 60 * 1000).getTime() }
      })
      .sort({ timestamp: 1 })
      .limit(500); // Limit to 500 events at a time

    cronlogInfo(`Found ${events.length} new events to upload to analytics system`);

    if (events.length == 0) {
      return;
    }

    // cronlogDebug(`Events to upload: ${events.map(e => e._id).join(', ')}`); // !! very verbose !!
    let lastUploadedTimestamp: number | undefined = undefined;

    // Upload events to analytics system

    if (
      !process.env.POSTHOG_API_KEY ||
      process.env.POSTHOG_API_KEY.length == 0 ||
      !process.env.POSTHOG_HOST ||
      process.env.POSTHOG_HOST.length == 0 ||
      !process.env.POSTHOG_ID_HASH_PEPPER ||
      process.env.POSTHOG_ID_HASH_PEPPER.length == 0
    ) {
      cronlogError(
        `POSTHOG_API_KEY or POSTHOG_HOST or POSTHOG_ID_HASH_PEPPER or POSTHOG_MOCKING_ENABLED is not set, cannot upload events to analytics system`
      );
      return;
    }

    if (process.env.POSTHOG_MOCKING_ENABLED && process.env.POSTHOG_MOCKING_ENABLED == "true") {
      // Do not upload events
      cronlogInfo(`POSTHOG_MOCKING_ENABLED is true, skipping upload of events to analytics system`);
      return;
    }

    const postHogClient = new PostHog(process.env.POSTHOG_API_KEY, {
      host: process.env.POSTHOG_HOST
    });

    // Set up error handling
    postHogClient.on("error", (err) => {
      cronlogError("PostHog had an error!", err);
      cronlogError("PostHog had an error: ", err?.response?.body || "Unknown");
    });

    for (const event of events) {
      const distinctId = event.userId ? event.userId : event.deviceId;

      if (distinctId === "cron") {
        cronlogDebug(`Skipping event ${event._id} with no distinctive id`);
        continue;
      }
      if (!distinctId) {
        cronlogDebug(`Skipping event ${event._id} with no distinctive id`);
        continue;
      }

      // Hash distinctId with pepper
      // this way we don't send raw user IDs or device IDs to PostHog
      const distinctIdHashed = await createHash("sha256")
        .update(distinctId + process.env.POSTHOG_ID_HASH_PEPPER)
        .digest("hex");

      // Make sure forceUserId is not sent to PostHog
      if (event.eventdata?.forceUserId) {
        delete event.eventdata.forceUserId;
      }

      const postHogProperties = {
        ...event.eventdata,
        uuid: event._id.toString(),
        platform: event.platform,
        appVersion: event.appVersion
      };

      postHogClient.capture({
        distinctId: distinctIdHashed,
        event: event.type,
        properties: postHogProperties,
        timestamp: new Date(event.timestamp)
      });

      lastUploadedTimestamp = event.timestamp;
    }

    // Send queued events immediately
    try {
      await postHogClient.shutdown();
    } catch (error) {
      cronlogError(`Error while shutting down PostHog client: ${error.message}`, error);
      throw new Error(`Failed to upload events to analytics system: ${error.message}`);
      // Abort so we don't update lastEventTimestamp
    }

    // Update lastEventTimestamp
    if (lastUploadedTimestamp) {
      await this.globalService.setGlobal<number>(GlobalKey.LAST_EVENT_SENT_TO_ANALYTICS, lastUploadedTimestamp);
      cronlogInfo(`Updated last event timestamp sent to analytics to ${lastUploadedTimestamp}`);
    }

    cronlogInfo(`Finished uploading events to external analytics system`);
  }
}
