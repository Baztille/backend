import { Injectable } from "@nestjs/common";
import { I18nService } from "nestjs-i18n";
import { FirebaseNotification } from "src/common/firebase/firebase-notification.type";
import { FirebaseService } from "src/common/firebase/firebase.service";
import { DeviceTokenService } from "src/profile/user/device-token.service";
import { logError, logInfo } from "src/utils/logger";
import { BaztilleChatMessage } from "../chat.schema";

export interface MatrixNotificationDevice {
  pushkey: string;
  app_id: string;
  pushkey_ts?: number;
  data?: any;
  tweaks?: any;
}

export interface MatrixNotificationPayload {
  type: string;
  room_id?: string;
  room_name?: string;
  room_alias?: string;
  sender?: string;
  sender_display_name?: string;
  content?: {
    body?: string;
    msgtype?: string;
    [key: string]: any;
  };
  devices?: MatrixNotificationDevice[];
  counts?: {
    unread?: number;
    missed_calls?: number;
  };
  prio?: string;
}

/**
 * ChatNotificationService
 *
 * Handles Matrix Push Gateway API notifications and FCM delivery.
 *
 * NOTIFICATION TOKEN LIFECYCLE:
 * This service is responsible for the "Token Usage" phase of the notification lifecycle.
 * It processes incoming Matrix notifications, validates tokens, sends FCM notifications,
 * handles FCM errors, and reports rejected tokens back to Matrix.
 *
 * For complete documentation on the notification token lifecycle, see:
 * docs/NOTIFICATION_TOKEN_LIFECYCLE.md
 *
 * Key responsibilities:
 * - Receive notifications from Matrix Push Gateway
 * - Pre-validate tokens before sending (skip already invalid)
 * - Send FCM notifications via FirebaseService
 * - Classify FCM errors (permanent vs transient)
 * - Invalidate tokens on permanent errors
 * - Track success/error history via DeviceTokenService
 * - Return rejected tokens to Matrix for cleanup
 */
@Injectable()
export class ChatNotificationService {
  constructor(
    private readonly firebaseService: FirebaseService,
    private readonly deviceTokenService: DeviceTokenService,
    private readonly i18n: I18nService
  ) {}

  /**
   * Process Matrix push notification and send to all devices
   * Returns list of rejected tokens for Matrix to clean up
   */
  async processMatrixNotification(notification: MatrixNotificationPayload): Promise<{ rejected: string[] }> {
    logInfo("MATRIX PUSH:", notification);

    const rejectedTokens: string[] = [];
    let bSendNotif = false;

    // Only process room messages for now
    if (notification.type === "m.room.message") {
      bSendNotif = true;

      const devices = notification.devices || [];
      if (devices.length === 0) {
        logError("No devices found in notification:", notification);
        return { rejected: [] };
      }

      const message: BaztilleChatMessage = this.analyzeRawChatMessage(notification.content?.body || "");

      // Prepare base notification (shared by all devices)
      const baseNotif: Partial<FirebaseNotification> = {
        title: notification.room_name || "Baztille",
        body: message.trimmedMessage
      };

      // By default, redirect user to corresponding room
      baseNotif.gotopageUrl = "/messages/discussion/" + notification.room_id;

      let bTranslatableMessage = false;

      if (message.metadata) {
        // Message have some metadata
        // This is only possible if sender is Baztille Chat admin

        if (
          notification.sender &&
          notification.sender == "@" + process.env.CHAT_SERVICE_ADMIN_USER + ":" + process.env.CHAT_SERVICE_SERVERNAME
        ) {
          // Authorized!
          if (message.metadata.doNotNotify) {
            // Admin do not want that this message generate a Firebase notification
            // => interrupt process here
            return { rejected: [] };
          }
          if (message.metadata.gotopageUrl) {
            baseNotif.gotopageUrl = message.metadata.gotopageUrl;
          }
          if (message.metadata.gotopage) {
            // DEPRECATED: use gotopageUrl instead
            baseNotif.gotopage = message.metadata.gotopage;
          }
          if (message.metadata.gotopageArgsargs) {
            // DEPRECATED: use gotopageUrl instead
            baseNotif.gotopageArgsargs = message.metadata.gotopageArgsargs;
          }
          if (message.metadata.alert_message) {
            baseNotif.alert_message = message.metadata.alert_message;
          }
          if (message.metadata.data) {
            baseNotif.data = message.metadata.data;
          }
          if (message.metadata?.translate) {
            // This message is marked as "translatable" (= app will translate it)
            bTranslatableMessage = true;
          }
        } else {
          // Unauthorized!
          logError("SECURITY ALERT: User is trying to send metadata as non-admin: ", notification);

          bSendNotif = false;
          message.metadata = {};

          // Note: do not throw error so Matrix is not trying to send it again
        }
      }

      if (bTranslatableMessage) {
        // Message itself will be translated by our app, however notification title and body will be displayed directly by Android/iOS
        // => we need to give them here a translation
        // Note: this is not mandatory to provide the exact same translation as the app will do, but at least something close

        // TODO: for now we do not have here the language of the target user, so just provide a French translation
        const body_translated: string = this.i18n.t("notifications." + baseNotif.body, { lang: "fr" });
        const title_translated: string = this.i18n.t("notifications." + baseNotif.title, { lang: "fr" });

        // Overwrite original string only if translation is found
        baseNotif.body = body_translated != "notifications." + baseNotif.body ? body_translated : baseNotif.body;
        baseNotif.title = title_translated != "notifications." + baseNotif.title ? title_translated : baseNotif.title;
      }

      if (bSendNotif) {
        // Process each device
        for (const device of devices) {
          const result = await this.sendToDevice(device, baseNotif);
          if (result.rejected) {
            rejectedTokens.push(device.pushkey);
          }
        }
      }
    }

    logInfo(`Matrix notification processed: ${rejectedTokens.length} tokens rejected`);

    return { rejected: rejectedTokens };
  }

  /**
   * Analyze chat input message and extract metadata
   * @returns analyzed message
   */
  private analyzeRawChatMessage(messageContent: string): BaztilleChatMessage {
    const res: BaztilleChatMessage = {
      textMessage: "", // The readable text message
      trimmedMessage: "", // The "trimmed" message (ex: used for notification text)
      metadata: {} // Metadata contained in the message (ex: gotopage, alert, ...)
    };

    // Extract message metadata
    // Note: Metadata is a JSON contains after ##baztilledata##
    const metadata_marker = "##baztilledata##";
    const metadata_string = messageContent.split(metadata_marker)[1];
    res.textMessage = messageContent.split(metadata_marker)[0];

    if (metadata_string) {
      // Some metadata in the message
      try {
        res.metadata = JSON.parse(metadata_string);
      } catch (parsing_error) {
        logInfo("analyzeRawChatMessage: cannot parse JSON => ignoring data");
      }
    }

    // Compute a displayable message content (for the notification text)
    const limitedLength = 200;
    res.trimmedMessage =
      res.textMessage.length > limitedLength
        ? res.textMessage.substring(0, limitedLength - 3) + "..."
        : res.textMessage;

    return res;
  }

  /**
   * Send notification to a single device
   * Returns whether the token should be rejected
   */
  private async sendToDevice(
    device: MatrixNotificationDevice,
    baseNotif: Partial<FirebaseNotification>
  ): Promise<{ rejected: boolean }> {
    const pushkey = device?.pushkey;

    if (!pushkey) {
      logInfo("Device missing pushkey, skipping:", device);
      return { rejected: false };
    }

    // Check if token is already marked as invalid
    const tokenDoc = await this.deviceTokenService.findByToken(pushkey);
    if (tokenDoc?.invalidAt) {
      logInfo(`Token ${pushkey.substring(0, 20)}... is already invalid, rejecting`);
      return { rejected: true };
    }

    // Build notification with token
    const notif: FirebaseNotification = {
      ...baseNotif,
      token: pushkey
    } as FirebaseNotification;

    logInfo("Sending notif to FCM:", notif);

    // Send notification
    const result = await this.firebaseService.sendNotification(notif);

    // Handle result
    if (result.success) {
      // Update success timestamp
      await this.deviceTokenService.recordSuccess(pushkey).catch((err) => {
        logError("Failed to record success for token:", err);
      });
      return { rejected: false };
    } else {
      // Record error
      await this.deviceTokenService.recordError(pushkey, result.errorMessage || "Unknown error").catch((err) => {
        logError("Failed to record error for token:", err);
      });

      // If permanently rejected, invalidate
      if (result.rejectedToken) {
        await this.deviceTokenService.invalidateToken(pushkey, result.errorCode || "unknown").catch((err) => {
          logError("Failed to invalidate token:", err);
        });
        return { rejected: true };
      }

      return { rejected: false };
    }
  }
}
