import { logInfo } from "src/utils/logger";
import mongoose from "mongoose";
import { getMongoose } from "./migration.models";

/**
 * Convert decision collection nested version properties from snake_case to camelCase
 * This migration handles the versions arrays within various objects in the d_decision collection
 *
 * d_decision collection nested properties:
 * - propositions[].versions[].creation_date -> creationDate
 * - subject.versions[].creation_date -> creationDate
 * - mostVotedProposition.versions[].creation_date -> creationDate
 * - submittedPropositions[].versions[].creation_date -> creationDate
 * - submittedSubjects[].versions[].creation_date -> creationDate
 */

/**
 * Helper function to convert versions array in any object
 */
function convertVersionsArray(obj: any): any {
  if (!obj || !obj.versions || !Array.isArray(obj.versions)) {
    return obj;
  }

  const updated = { ...obj };
  updated.versions = obj.versions.map((version: any) => {
    const updatedVersion: any = { ...version };
    if ("creation_date" in version) {
      updatedVersion.creationDate = version.creation_date;
      delete updatedVersion.creation_date;
    }
    return updatedVersion;
  });

  return updated;
}

/**
 * Helper function to revert versions array in any object
 */
function revertVersionsArray(obj: any): any {
  if (!obj || !obj.versions || !Array.isArray(obj.versions)) {
    return obj;
  }

  const reverted = { ...obj };
  reverted.versions = obj.versions.map((version: any) => {
    const revertedVersion: any = { ...version };
    if ("creationDate" in version) {
      revertedVersion.creation_date = version.creationDate;
      delete revertedVersion.creationDate;
    }
    return revertedVersion;
  });

  return reverted;
}

async function up() {
  logInfo("🚀🚀 Converting decision collection nested versions properties from snake_case to camelCase...");

  const db = (await getMongoose()).connection.db;
  const decisionCollection = db.collection("d_decision");

  // Find all decisions
  const decisions = await decisionCollection.find({}).toArray();

  logInfo(`Found ${decisions.length} decisions to process`);

  let totalUpdated = 0;

  for (const decision of decisions) {
    const updates: any = {};
    let hasUpdates = false;

    // 1. Update propositions array (if exists)
    if (decision.propositions && Array.isArray(decision.propositions)) {
      const updatedPropositions = decision.propositions.map((prop: any) => convertVersionsArray(prop));
      updates.propositions = updatedPropositions;
      hasUpdates = true;
    }

    // 2. Update subject object (if exists)
    if (decision.subject && typeof decision.subject === "object") {
      updates.subject = convertVersionsArray(decision.subject);
      hasUpdates = true;
    }

    // 3. Update mostVotedProposition object (if exists)
    if (decision.mostVotedProposition && typeof decision.mostVotedProposition === "object") {
      updates.mostVotedProposition = convertVersionsArray(decision.mostVotedProposition);
      hasUpdates = true;
    }

    // 4. Update submittedPropositions array (if exists)
    if (decision.submittedPropositions && Array.isArray(decision.submittedPropositions)) {
      const updatedSubmittedPropositions = decision.submittedPropositions.map((prop: any) =>
        convertVersionsArray(prop)
      );
      updates.submittedPropositions = updatedSubmittedPropositions;
      hasUpdates = true;
    }

    // 5. Update submittedSubjects array (if exists)
    if (decision.submittedSubjects && Array.isArray(decision.submittedSubjects)) {
      const updatedSubmittedSubjects = decision.submittedSubjects.map((subj: any) => convertVersionsArray(subj));
      updates.submittedSubjects = updatedSubmittedSubjects;
      hasUpdates = true;
    }

    // Apply updates if any changes were made
    if (hasUpdates) {
      await decisionCollection.updateOne({ _id: decision._id }, { $set: updates });
      totalUpdated++;
    }
  }

  logInfo(`✅ Decision versions conversion completed. Total decisions updated: ${totalUpdated}`);
}

async function down() {
  logInfo("🚀🚀 Reverting decision collection nested versions properties back to snake_case...");

  const db = (await getMongoose()).connection.db;
  const decisionCollection = db.collection("d_decision");

  // Find all decisions
  const decisions = await decisionCollection.find({}).toArray();

  logInfo(`Found ${decisions.length} decisions to revert`);

  let totalReverted = 0;

  for (const decision of decisions) {
    const updates: any = {};
    let hasUpdates = false;

    // 1. Revert propositions array (if exists)
    if (decision.propositions && Array.isArray(decision.propositions)) {
      const revertedPropositions = decision.propositions.map((prop: any) => revertVersionsArray(prop));
      updates.propositions = revertedPropositions;
      hasUpdates = true;
    }

    // 2. Revert subject object (if exists)
    if (decision.subject && typeof decision.subject === "object") {
      updates.subject = revertVersionsArray(decision.subject);
      hasUpdates = true;
    }

    // 3. Revert mostVotedProposition object (if exists)
    if (decision.mostVotedProposition && typeof decision.mostVotedProposition === "object") {
      updates.mostVotedProposition = revertVersionsArray(decision.mostVotedProposition);
      hasUpdates = true;
    }

    // 4. Revert submittedPropositions array (if exists)
    if (decision.submittedPropositions && Array.isArray(decision.submittedPropositions)) {
      const revertedSubmittedPropositions = decision.submittedPropositions.map((prop: any) =>
        revertVersionsArray(prop)
      );
      updates.submittedPropositions = revertedSubmittedPropositions;
      hasUpdates = true;
    }

    // 5. Revert submittedSubjects array (if exists)
    if (decision.submittedSubjects && Array.isArray(decision.submittedSubjects)) {
      const revertedSubmittedSubjects = decision.submittedSubjects.map((subj: any) => revertVersionsArray(subj));
      updates.submittedSubjects = revertedSubmittedSubjects;
      hasUpdates = true;
    }

    // Apply updates if any changes were made
    if (hasUpdates) {
      await decisionCollection.updateOne({ _id: decision._id }, { $set: updates });
      totalReverted++;
    }
  }

  logInfo(`✅ Decision versions reversion completed. Total decisions reverted: ${totalReverted}`);
}

module.exports = { up, down };
