import { logInfo } from "src/utils/logger";
import mongoose from "mongoose";
import { getMongoose } from "./migration.models";

/**
 * Convert nested array/object properties from snake_case to camelCase
 * This migration handles properties within arrays and nested objects that were not
 * handled by the simple $rename operation in the main camelCase migration
 *
 * Collections and nested properties:
 * - d_debate_argument: versions[].creation_date -> creationDate
 * - d_debate_context: submittedContext[].votes_count -> votesCount
 * - u_user: recruits (Map values).last_vote_time -> lastVoteTime
 * - u_user: missionsCompleted (Map values).collection_date -> collectionDate
 */

async function up() {
  logInfo("🚀🚀 Converting nested properties from snake_case to camelCase...");

  const db = (await getMongoose()).connection.db;
  let totalUpdated = 0;

  // 1. Update d_debate_argument collection - versions array
  logInfo("Processing d_debate_argument collection...");
  const debateArgumentCollection = db.collection("d_debate_argument");
  const debateArguments = await debateArgumentCollection
    .find({
      versions: { $exists: true, $ne: [] }
    })
    .toArray();

  logInfo(`  Found ${debateArguments.length} debate arguments with versions to update`);

  for (const doc of debateArguments) {
    if (!doc.versions || !Array.isArray(doc.versions)) continue;

    const updatedVersions = doc.versions.map((version: any) => {
      const updated: any = { ...version };
      if ("creation_date" in version) {
        updated.creationDate = version.creation_date;
        delete updated.creation_date;
      }
      return updated;
    });

    await debateArgumentCollection.updateOne({ _id: doc._id }, { $set: { versions: updatedVersions } });
    totalUpdated++;
  }

  logInfo(`  ✅ Updated ${debateArguments.length} debate arguments`);

  // 2. Update d_debate_context collection - submittedContext array
  logInfo("Processing d_debate_context collection...");
  const debateContextCollection = db.collection("d_debate_context");
  const debateContexts = await debateContextCollection
    .find({
      submittedContext: { $exists: true, $ne: [] }
    })
    .toArray();

  logInfo(`  Found ${debateContexts.length} debate contexts with submitted contexts to update`);

  for (const doc of debateContexts) {
    if (!doc.submittedContext || !Array.isArray(doc.submittedContext)) continue;

    const updatedSubmittedContext = doc.submittedContext.map((context: any) => {
      const updated: any = { ...context };
      if ("votes_count" in context) {
        updated.votesCount = context.votes_count;
        delete updated.votes_count;
      }
      return updated;
    });

    await debateContextCollection.updateOne({ _id: doc._id }, { $set: { submittedContext: updatedSubmittedContext } });
    totalUpdated++;
  }

  logInfo(`  ✅ Updated ${debateContexts.length} debate contexts`);

  // 3. Update u_user collection - recruits Map
  logInfo("Processing u_user collection - recruits...");
  const userCollection = db.collection("u_user");
  const usersWithRecruits = await userCollection
    .find({
      recruits: { $exists: true, $ne: {} }
    })
    .toArray();

  logInfo(`  Found ${usersWithRecruits.length} users with recruits to update`);

  for (const user of usersWithRecruits) {
    if (!user.recruits || typeof user.recruits !== "object") continue;

    const updatedRecruits: any = {};
    let hasChanges = false;

    for (const [recruitId, recruitData] of Object.entries(user.recruits)) {
      const data = recruitData as any;
      const updated: any = { ...data };

      if ("last_vote_time" in data) {
        updated.lastVoteTime = data.last_vote_time;
        delete updated.last_vote_time;
        hasChanges = true;
      }

      updatedRecruits[recruitId] = updated;
    }

    if (hasChanges) {
      await userCollection.updateOne({ _id: user._id }, { $set: { recruits: updatedRecruits } });
      totalUpdated++;
    }
  }

  logInfo(`  ✅ Updated recruits for users`);

  // 4. Update u_user collection - missionsCompleted Map
  logInfo("Processing u_user collection - missionsCompleted...");
  const usersWithMissions = await userCollection
    .find({
      missionsCompleted: { $exists: true, $ne: {} }
    })
    .toArray();

  logInfo(`  Found ${usersWithMissions.length} users with completed missions to update`);

  for (const user of usersWithMissions) {
    if (!user.missionsCompleted || typeof user.missionsCompleted !== "object") continue;

    const updatedMissions: any = {};
    let hasChanges = false;

    for (const [missionSlug, missionData] of Object.entries(user.missionsCompleted)) {
      const data = missionData as any;
      const updated: any = { ...data };

      if ("collection_date" in data) {
        updated.collectionDate = data.collection_date;
        delete updated.collection_date;
        hasChanges = true;
      }

      updatedMissions[missionSlug] = updated;
    }

    if (hasChanges) {
      await userCollection.updateOne({ _id: user._id }, { $set: { missionsCompleted: updatedMissions } });
      totalUpdated++;
    }
  }

  logInfo(`  ✅ Updated missionsCompleted for users`);

  logInfo(`✅ Nested properties conversion completed. Total documents updated: ${totalUpdated}`);
}

async function down() {
  logInfo("🚀🚀 Reverting nested properties back to snake_case...");

  const db = (await getMongoose()).connection.db;
  let totalReverted = 0;

  // 1. Revert d_debate_argument collection - versions array
  logInfo("Reverting d_debate_argument collection...");
  const debateArgumentCollection = db.collection("d_debate_argument");
  const debateArguments = await debateArgumentCollection
    .find({
      versions: { $exists: true, $ne: [] }
    })
    .toArray();

  for (const doc of debateArguments) {
    if (!doc.versions || !Array.isArray(doc.versions)) continue;

    const revertedVersions = doc.versions.map((version: any) => {
      const reverted: any = { ...version };
      if ("creationDate" in version) {
        reverted.creation_date = version.creationDate;
        delete reverted.creationDate;
      }
      return reverted;
    });

    await debateArgumentCollection.updateOne({ _id: doc._id }, { $set: { versions: revertedVersions } });
    totalReverted++;
  }

  logInfo(`  ✅ Reverted ${debateArguments.length} debate arguments`);

  // 2. Revert d_debate_context collection - submittedContext array
  logInfo("Reverting d_debate_context collection...");
  const debateContextCollection = db.collection("d_debate_context");
  const debateContexts = await debateContextCollection
    .find({
      submittedContext: { $exists: true, $ne: [] }
    })
    .toArray();

  for (const doc of debateContexts) {
    if (!doc.submittedContext || !Array.isArray(doc.submittedContext)) continue;

    const revertedSubmittedContext = doc.submittedContext.map((context: any) => {
      const reverted: any = { ...context };
      if ("votesCount" in context) {
        reverted.votes_count = context.votesCount;
        delete reverted.votesCount;
      }
      return reverted;
    });

    await debateContextCollection.updateOne({ _id: doc._id }, { $set: { submittedContext: revertedSubmittedContext } });
    totalReverted++;
  }

  logInfo(`  ✅ Reverted ${debateContexts.length} debate contexts`);

  // 3. Revert u_user collection - recruits Map
  logInfo("Reverting u_user collection - recruits...");
  const userCollection = db.collection("u_user");
  const usersWithRecruits = await userCollection
    .find({
      recruits: { $exists: true, $ne: {} }
    })
    .toArray();

  for (const user of usersWithRecruits) {
    if (!user.recruits || typeof user.recruits !== "object") continue;

    const revertedRecruits: any = {};
    let hasChanges = false;

    for (const [recruitId, recruitData] of Object.entries(user.recruits)) {
      const data = recruitData as any;
      const reverted: any = { ...data };

      if ("lastVoteTime" in data) {
        reverted.last_vote_time = data.lastVoteTime;
        delete reverted.lastVoteTime;
        hasChanges = true;
      }

      revertedRecruits[recruitId] = reverted;
    }

    if (hasChanges) {
      await userCollection.updateOne({ _id: user._id }, { $set: { recruits: revertedRecruits } });
      totalReverted++;
    }
  }

  logInfo(`  ✅ Reverted recruits for users`);

  // 4. Revert u_user collection - missionsCompleted Map
  logInfo("Reverting u_user collection - missionsCompleted...");
  const usersWithMissions = await userCollection
    .find({
      missionsCompleted: { $exists: true, $ne: {} }
    })
    .toArray();

  for (const user of usersWithMissions) {
    if (!user.missionsCompleted || typeof user.missionsCompleted !== "object") continue;

    const revertedMissions: any = {};
    let hasChanges = false;

    for (const [missionSlug, missionData] of Object.entries(user.missionsCompleted)) {
      const data = missionData as any;
      const reverted: any = { ...data };

      if ("collectionDate" in data) {
        reverted.collection_date = data.collectionDate;
        delete reverted.collectionDate;
        hasChanges = true;
      }

      revertedMissions[missionSlug] = reverted;
    }

    if (hasChanges) {
      await userCollection.updateOne({ _id: user._id }, { $set: { missionsCompleted: revertedMissions } });
      totalReverted++;
    }
  }

  logInfo(`  ✅ Reverted missionsCompleted for users`);

  logInfo(`✅ Nested properties reversion completed. Total documents reverted: ${totalReverted}`);
}

module.exports = { up, down };
