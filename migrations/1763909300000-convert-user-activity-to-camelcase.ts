import { logInfo } from "src/utils/logger";
import mongoose from "mongoose";
import { getMongoose } from "./migration.models";

/**
 * Migration: Convert user activity object properties to camelCase
 *
 * Converts the following nested properties in u_user collection:
 * - activity.votes_nbr → activity.votesNbr
 */

export async function up() {
  console.log("Starting migration: convert user activity properties to camelCase");

  const db = (await getMongoose()).connection.db;
  const collection = db.collection("u_user");

  // Find all users that have an activity object with votes_nbr
  const users = await collection
    .find({
      "activity.votes_nbr": { $exists: true }
    })
    .toArray();

  console.log(`Found ${users.length} users with activity.votes_nbr to convert`);

  let convertedCount = 0;

  for (const user of users) {
    if (user.activity && typeof user.activity.votes_nbr !== "undefined") {
      // Create updated activity object
      const updatedActivity = { ...user.activity };

      // Rename votes_nbr to votesNbr
      updatedActivity.votesNbr = user.activity.votes_nbr;
      delete updatedActivity.votes_nbr;

      // Update the document
      await collection.updateOne({ _id: user._id }, { $set: { activity: updatedActivity } });

      convertedCount++;

      if (convertedCount % 100 === 0) {
        console.log(`Converted ${convertedCount}/${users.length} users...`);
      }
    }
  }

  console.log(`Migration complete: Converted activity.votes_nbr → activity.votesNbr for ${convertedCount} users`);
}

export async function down() {
  console.log("Starting rollback: revert user activity properties to snake_case");

  const db = (await getMongoose()).connection.db;
  const collection = db.collection("u_user");

  // Find all users that have an activity object with votesNbr
  const users = await collection
    .find({
      "activity.votesNbr": { $exists: true }
    })
    .toArray();

  console.log(`Found ${users.length} users with activity.votesNbr to revert`);

  let revertedCount = 0;

  for (const user of users) {
    if (user.activity && typeof user.activity.votesNbr !== "undefined") {
      // Create reverted activity object
      const revertedActivity = { ...user.activity };

      // Rename votesNbr back to votes_nbr
      revertedActivity.votes_nbr = user.activity.votesNbr;
      delete revertedActivity.votesNbr;

      // Update the document
      await collection.updateOne({ _id: user._id }, { $set: { activity: revertedActivity } });

      revertedCount++;

      if (revertedCount % 100 === 0) {
        console.log(`Reverted ${revertedCount}/${users.length} users...`);
      }
    }
  }

  console.log(`Rollback complete: Reverted activity.votesNbr → activity.votes_nbr for ${revertedCount} users`);
}
