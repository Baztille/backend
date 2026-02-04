import { Injectable } from "@nestjs/common";
import * as firebase from "firebase-admin";
import { logDebug, logError, logInfo } from "src/utils/logger";
import { FirebaseNotification } from "./firebase-notification.type";

// Type guard for Firebase errors
interface FirebaseError {
  code: string;
  message: string;
  name: string;
  stack?: string;
}

function isFirebaseError(error: unknown): error is FirebaseError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as FirebaseError).code === "string" &&
    "message" in error &&
    typeof (error as FirebaseError).message === "string"
  );
}

/**
 * Permanent FCM error codes that indicate the token should be invalidated
 * Based on: https://firebase.google.com/docs/cloud-messaging/send-message#admin_sdk_error_reference
 */
const PERMANENT_ERROR_CODES = [
  "messaging/invalid-registration-token",
  "messaging/registration-token-not-registered",
  "messaging/mismatched-credential",
  "messaging/invalid-argument" // Malformed token
];

/**
 * Transient FCM error codes that should NOT invalidate the token
 */
const TRANSIENT_ERROR_CODES = [
  "messaging/server-unavailable",
  "messaging/internal-error",
  "messaging/quota-exceeded",
  "messaging/unavailable",
  "messaging/third-party-auth-error"
];

export interface SendNotificationResult {
  success: boolean;
  rejectedToken?: string;
  errorCode?: string;
  errorMessage?: string;
}

@Injectable()
export class FirebaseService {
  firebaseClient: firebase.app.App;

  constructor() {
    this.initFirebaseClient();
  }

  /**
   * Send a test notification
   * @returns {bool} true if success
   */
  async test(notif: FirebaseNotification): Promise<void> {
    this.sendNotification(notif);
  }

  /**
   * Check if an error code indicates permanent token invalidation
   */
  isPermanentError(errorCode: string): boolean {
    return PERMANENT_ERROR_CODES.includes(errorCode);
  }

  /**
   * Check if an error code indicates a transient failure
   */
  isTransientError(errorCode: string): boolean {
    return TRANSIENT_ERROR_CODES.includes(errorCode);
  }

  /**
   * Send a notification via FCM
   * @param notif Notification data
   * @returns Result with success status and optional rejection/error info
   */
  async sendNotification(notif: FirebaseNotification): Promise<SendNotificationResult> {
    //logDebug("Sending notification: ", notif);

    const message: firebase.messaging.Message = {
      data: {},
      notification: {
        title: notif.title,
        body: notif.body
      },
      token: notif.token
    };

    if (message.data != undefined) {
      // undefined message.data should never happened (here for Typescript strict null checks)

      if (notif.gotopageUrl) {
        message.data.gotopageUrl = notif.gotopageUrl;
      }

      if (notif.gotopage) {
        // DEPRECATED: use gotopageUrl instead
        message.data.gotopage = notif.gotopage;

        if (notif.gotopageArgsargs) {
          message.data.gotopageArgsargs = JSON.stringify(notif.gotopageArgsargs); // Note: Firebase only accept strings in notif data field
        }
      }

      if (notif.alert_message) {
        message.data.alert_message = notif.alert_message;
      }

      if (notif.data) {
        message.data.data = notif.data;
      }

      if (process.env.FIREBASE_MOCKING_ENABLED && process.env.FIREBASE_MOCKING_ENABLED == "true") {
        logInfo("Firebase MOCKING enabled: notif not sent. Message would be:", message);
        return { success: true };
      } else {
        try {
          const response = await this.firebaseClient.messaging().send(message);

          // Response is a message ID string.
          logDebug("Successfully sent firebase notification (token " + notif.token + "):", response);

          return { success: true };
        } catch (error: unknown) {
          logError("Error sending firebase notification:", error);

          if (isFirebaseError(error)) {
            logDebug("Firebase error details:", {
              code: error.code,
              message: error.message,
              name: error.name,
              stack: error.stack
            });

            // Classify error as permanent or transient
            if (this.isPermanentError(error.code)) {
              logInfo(`Token ${notif.token.substring(0, 20)}... is permanently invalid: ${error.code}`);

              // Return rejected token so caller can invalidate it
              return {
                success: false,
                rejectedToken: notif.token,
                errorCode: error.code,
                errorMessage: error.message
              };
            } else if (this.isTransientError(error.code)) {
              logInfo(`Token ${notif.token.substring(0, 20)}... encountered transient error: ${error.code}`);

              // Return error info but no rejected token
              return {
                success: false,
                errorCode: error.code,
                errorMessage: error.message
              };
            } else {
              // Unknown error code - log but don't reject (be conservative)
              logError(`Unknown Firebase error code: ${error.code}`);

              return {
                success: false,
                errorCode: error.code,
                errorMessage: error.message
              };
            }
          }

          // Non-Firebase error
          return {
            success: false,
            errorMessage: error instanceof Error ? error.message : "Unknown error"
          };
        }
      }
    }

    // Should never reach here, but TypeScript needs a return
    return { success: false, errorMessage: "message.data is undefined" };
  }

  /*************************************************
   ***************** UTILITIES *********************
   ************************************************/

  private initFirebaseClient() {
    logInfo("Initializing Firebase");

    const config = this.getFirebaseConfig();

    if (process.env.FIREBASE_MOCKING_ENABLED && process.env.FIREBASE_MOCKING_ENABLED == "true") {
      logInfo("Firebase mocking enabled: no real notifications will be sent");
    } else {
      this.firebaseClient = firebase.initializeApp({
        credential: firebase.credential.cert(config)
      });
    }

    logInfo("Firebase initialized");
  }

  private getFirebaseConfig() {
    // Useful for dev but may be dangerous (secrets inside)
    // logDebug(process.env.FIREBASE_CONFIG);
    try {
      return JSON.parse(process.env.FIREBASE_CONFIG ?? "{}");
    } catch (error) {
      logError("Error during Firebase config reading: check FIREBASE_CONFIG syntax in .env");
    }
  }
}
