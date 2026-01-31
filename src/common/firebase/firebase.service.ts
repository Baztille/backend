import { Injectable } from "@nestjs/common";
import * as firebase from "firebase-admin";
import { logDebug, logError, logInfo } from "src/utils/logger";
import { FirebaseNotification } from "./firebase-notification.type";

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

  async sendNotification(notif: FirebaseNotification) {
    logDebug("Sending notification: ", notif);

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

      if (notif.gotopage_url) {
        message.data.gotopage_url = notif.gotopage_url;
      }

      if (notif.gotopage) {
        // DEPRECATED: use gotopage_url instead
        message.data.gotopage = notif.gotopage;

        if (notif.gotopage_args) {
          message.data.gotopage_args = JSON.stringify(notif.gotopage_args); // Note: Firebase only accept strings in notif data field
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
      } else {
        this.firebaseClient
          .messaging()
          .send(message)
          .then((response) => {
            // Response is a message ID string.
            logDebug("Successfully sent firebase notification:", response);
          })
          .catch((error) => {
            logError("Error sending firebase notification:", error);
          });
      }
    }
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
