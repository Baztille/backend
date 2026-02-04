import { logError, logInfo } from "src/utils/logger";
import { getMongoose } from "./migration.models";

/**
 * Migration: Backfill device_tokens collection from users.devices
 *
 * This migration creates a reverse index of FCM tokens in the u_device_tokens collection
 * by extracting notifToken from all users' devices.
 */

export async function up() {
  logInfo("Starting migration: backfill device_tokens collection");

  const db = (await getMongoose()).connection.db;
  const usersCollection = db.collection("u_user");
  const deviceTokensCollection = db.collection("u_device_tokens");

  // Find all users with devices that have notifToken
  const users = await usersCollection
    .find(
      {
        devices: { $exists: true, $ne: {} },
        removedAccountDate: { $exists: false } // Exclude deleted accounts
      },
      {
        projection: {
          _id: 1,
          devices: 1
        }
      }
    )
    .toArray();

  logInfo(`Found ${users.length} users with devices`);

  let tokensProcessed = 0;
  let tokensInserted = 0;
  let tokensSkipped = 0;

  for (const user of users) {
    if (!user.devices || typeof user.devices !== "object") {
      continue;
    }

    // Iterate through all devices for this user
    for (const [deviceId, deviceInfo] of Object.entries(user.devices)) {
      if (!deviceInfo || typeof deviceInfo !== "object") {
        continue;
      }

      const deviceData = deviceInfo as any;
      const notifToken = deviceData.notifToken;

      if (!notifToken || typeof notifToken !== "string") {
        continue;
      }

      tokensProcessed++;

      try {
        // Upsert token into device_tokens collection
        await deviceTokensCollection.updateOne(
          { token: notifToken },
          {
            $set: {
              userId: user._id,
              deviceId: deviceId,
              updatedAt: new Date()
            },
            $setOnInsert: {
              createdAt: new Date(),
              invalidAt: null,
              invalidReason: null,
              lastSuccessAt: null,
              lastErrorAt: null,
              lastErrorMessage: null
            }
          },
          { upsert: true }
        );

        tokensInserted++;

        if (tokensInserted % 100 === 0) {
          logInfo(`Progress: ${tokensInserted} tokens inserted`);
        }
      } catch (error) {
        logError(`Error inserting token for user ${user._id}, device ${deviceId}:`, error);
        tokensSkipped++;
      }
    }
  }

  logInfo(
    `Migration completed: ${tokensProcessed} tokens processed, ${tokensInserted} inserted/updated, ${tokensSkipped} skipped`
  );
}

export async function down() {
  logInfo("Rolling back migration: backfill device_tokens collection");

  const db = (await getMongoose()).connection.db;
  const deviceTokensCollection = db.collection("u_device_tokens");

  // Delete all documents from device_tokens collection
  const result = await deviceTokensCollection.deleteMany({});

  logInfo(`Rolled back: deleted ${result.deletedCount} documents from u_device_tokens`);
}
