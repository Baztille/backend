import { logInfo } from "src/utils/logger";
import mongoose from "mongoose";
import { getMongoose } from "./migration.models";

/**
 * Rename debate-related collections to follow correct naming convention:
 * - d_decision_context -> d_debate_context
 * - d_decision_argument -> d_debate_argument
 *
 * These collections were incorrectly named with "decision" prefix instead of "debate"
 */
async function up() {
  logInfo("🚀🚀 Renaming debate collections...");

  const db = (await getMongoose()).connection.db;

  // Check if old collections exist and rename them
  const collections = await db.listCollections().toArray();

  logInfo("Existing collections:", collections.map((c) => c.name).join(", "));

  const collectionNames = collections.map((c) => c.name);

  // Rename d_decision_context to d_debate_context
  if (collectionNames.includes("d_decision_context")) {
    logInfo("Renaming collection: d_decision_context -> d_debate_context");
    await db.renameCollection("d_decision_context", "d_debate_context");
    logInfo("✅ Successfully renamed d_decision_context to d_debate_context");
  } else {
    logInfo("⚠️  Collection d_decision_context not found (may have already been renamed)");
  }

  // Rename d_decision_argument to d_debate_argument
  if (collectionNames.includes("d_decision_argument")) {
    logInfo("Renaming collection: d_decision_argument -> d_debate_argument");
    await db.renameCollection("d_decision_argument", "d_debate_argument");
    logInfo("✅ Successfully renamed d_decision_argument to d_debate_argument");
  } else {
    logInfo("⚠️  Collection d_decision_argument not found (may have already been renamed)");
  }

  logInfo("✅ Debate collections migration completed");
}

/**
 * Undo the collection renames (restore original names)
 */
async function down() {
  logInfo("🚀🚀 Reverting debate collections rename...");

  const db = (await getMongoose()).connection.db;
  const collections = await db.listCollections().toArray();
  const collectionNames = collections.map((c) => c.name);

  // Rename d_debate_context back to d_decision_context
  if (collectionNames.includes("d_debate_context")) {
    logInfo("Renaming collection: d_debate_context -> d_decision_context");
    await db.renameCollection("d_debate_context", "d_decision_context");
    logInfo("✅ Successfully renamed d_debate_context back to d_decision_context");
  } else {
    logInfo("⚠️  Collection d_debate_context not found");
  }

  // Rename d_debate_argument back to d_decision_argument
  if (collectionNames.includes("d_debate_argument")) {
    logInfo("Renaming collection: d_debate_argument -> d_decision_argument");
    await db.renameCollection("d_debate_argument", "d_decision_argument");
    logInfo("✅ Successfully renamed d_debate_argument back to d_decision_argument");
  } else {
    logInfo("⚠️  Collection d_debate_argument not found");
  }

  logInfo("✅ Debate collections migration rollback completed");
}

module.exports = { up, down };
