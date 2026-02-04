import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { logDebug, logError, logInfo } from "src/utils/logger";
import { DeviceTokenDocument, DeviceTokenMongo } from "./device-token.schema";
import { UserMongo } from "./user.schema";

@Injectable()
export class DeviceTokenService {
  constructor(
    @InjectModel(DeviceTokenMongo.name) private readonly deviceTokenModel: Model<DeviceTokenMongo>,
    @InjectModel(UserMongo.name) private readonly userModel: Model<UserMongo>
  ) {}

  /**
   * Upsert a device token (create or update)
   * @param token FCM registration token
   * @param userId User ID owning the token
   * @param deviceId Device UUID
   * @returns Created or updated device token document
   */
  async upsertToken(token: string, userId: string, deviceId: string): Promise<DeviceTokenDocument> {
    logDebug(`Upserting device token for user ${userId}, device ${deviceId}`);

    const now = new Date();

    const result = await this.deviceTokenModel.findOneAndUpdate(
      { token },
      {
        $set: {
          userId,
          deviceId,
          updatedAt: now
        },
        $setOnInsert: {
          createdAt: now,
          invalidAt: null,
          invalidReason: null
        }
      },
      {
        upsert: true,
        new: true
      }
    );

    logInfo(`Device token upserted: ${token.substring(0, 20)}... for user ${userId}`);

    return result;
  }

  /**
   * Mark a token as invalid (permanent failure) and clear it from user document
   * @param token FCM registration token
   * @param reason Firebase error code
   */
  async invalidateToken(token: string, reason: string): Promise<void> {
    logInfo(`Invalidating token ${token.substring(0, 20)}... with reason: ${reason}`);

    // First, get the token info to clear from user document
    const tokenInfo = await this.deviceTokenModel.findOne({ token }, { userId: 1, deviceId: 1 });

    // Update the token as invalid
    await this.deviceTokenModel.updateOne(
      { token },
      {
        $set: {
          invalidAt: new Date(),
          invalidReason: reason,
          updatedAt: new Date()
        }
      }
    );

    // Clear token from user document
    if (tokenInfo && tokenInfo.userId && tokenInfo.deviceId) {
      try {
        await this.userModel.updateOne(
          { _id: tokenInfo.userId },
          {
            $unset: {
              [`devices.${tokenInfo.deviceId}.notifToken`]: ""
            }
          }
        );

        logInfo(`Cleared token from user ${tokenInfo.userId}, device ${tokenInfo.deviceId}`);
      } catch (error) {
        logError(`Failed to clear token from user document:`, error);
        // Don't throw - invalidation succeeded, cleanup is optional
      }
    }
  }

  /**
   * Find a device token by token string
   * @param token FCM registration token
   * @returns Device token document or null if not found
   */
  async findByToken(token: string): Promise<DeviceTokenDocument | null> {
    return await this.deviceTokenModel.findOne({ token });
  }

  /**
   * Check if a token is valid (not invalidated)
   * @param token FCM registration token
   * @returns true if token is valid, false if invalidated or not found
   */
  async isTokenValid(token: string): Promise<boolean> {
    const deviceToken = await this.deviceTokenModel.findOne({ token }, { invalidAt: 1 });

    if (!deviceToken) {
      // Token not found - treat as potentially valid (might be new)
      return true;
    }

    return deviceToken.invalidAt == null;
  }

  /**
   * Record a successful FCM send for this token
   * @param token FCM registration token
   */
  async recordSuccess(token: string): Promise<void> {
    await this.deviceTokenModel.updateOne(
      { token },
      {
        $set: {
          lastSuccessAt: new Date(),
          updatedAt: new Date()
        }
      }
    );
  }

  /**
   * Record a failed FCM send for this token (non-permanent error)
   * @param token FCM registration token
   * @param errorMessage Error message
   */
  async recordError(token: string, errorMessage: string): Promise<void> {
    await this.deviceTokenModel.updateOne(
      { token },
      {
        $set: {
          lastErrorAt: new Date(),
          lastErrorMessage: errorMessage,
          updatedAt: new Date()
        }
      }
    );
  }

  /**
   * Get all invalid tokens (for cleanup or reporting)
   * @returns List of invalid token documents
   */
  async getInvalidTokens(): Promise<DeviceTokenDocument[]> {
    return this.deviceTokenModel.find({ invalidAt: { $ne: null } });
  }

  /**
   * Get device token info by token string
   * @param token FCM registration token
   * @returns Device token document or null
   */
  async getTokenInfo(token: string): Promise<DeviceTokenDocument | null> {
    return this.deviceTokenModel.findOne({ token });
  }

  /**
   * Get all tokens for a specific user
   * @param userId User ID
   * @returns List of device token documents for this user
   */
  async getTokensByUserId(userId: string): Promise<DeviceTokenDocument[]> {
    return this.deviceTokenModel.find({ userId });
  }

  /**
   * Delete a token (for cleanup)
   * @param token FCM registration token
   */
  async deleteToken(token: string): Promise<void> {
    await this.deviceTokenModel.deleteOne({ token });
    logInfo(`Deleted device token: ${token.substring(0, 20)}...`);
  }

  /**
   * Backfill device tokens from user devices
   * This should be run once as a migration script
   * @param userDevices Array of { userId, deviceId, token }
   */
  async backfillTokens(userDevices: Array<{ userId: string; deviceId: string; token: string }>): Promise<void> {
    logInfo(`Starting backfill of ${userDevices.length} device tokens`);

    let successCount = 0;
    let errorCount = 0;

    for (const device of userDevices) {
      try {
        await this.upsertToken(device.token, device.userId, device.deviceId);
        successCount++;
      } catch (error) {
        logError(`Error backfilling token for user ${device.userId}, device ${device.deviceId}:`, error);
        errorCount++;
      }
    }

    logInfo(`Backfill completed: ${successCount} success, ${errorCount} errors`);
  }
}
