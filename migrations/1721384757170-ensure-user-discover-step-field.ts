import { UserDiscoverStep } from "src/profile/user/types/user-discover-step.enum";
import { logInfo } from "src/utils/logger";
import { getModels } from "./migration.models";

/**
 * Ensure all users have the discover step field set
 * This migration updates all users who don't have the discover step field set
 * to the default value of USER_DISCOVER_STEP.NOT_CONVINCED
 */
async function up() {
  logInfo("🚀🚀 Ensuring all users have discover step field set...");

  const { UserModel } = await getModels();

  // Find all users that don't have the discover step field set
  const usersWithoutDiscoverStep = await UserModel.find({
    $or: [{ discover_step: { $exists: false } }, { discover_step: null }, { discover_step: undefined }]
  });

  logInfo(`Found ${usersWithoutDiscoverStep.length} users without discover step field`);

  if (usersWithoutDiscoverStep.length > 0) {
    // Update all users without discover step to have NOT_CONVINCED discover step
    const result = await UserModel.updateMany(
      {
        $or: [{ discover_step: { $exists: false } }, { discover_step: null }, { discover_step: undefined }]
      },
      {
        $set: { discover_step: UserDiscoverStep.NOT_CONVINCED }
      }
    );

    logInfo(`Updated ${result.modifiedCount} users with discover step: ${UserDiscoverStep.NOT_CONVINCED}`);
  }

  logInfo("✅ User discover step migration completed");
}

/**
 * This migration cannot be easily undone as we don't know which users
 * originally had the discover_step field and which didn't
 */
async function down() {
  logInfo("🚀🚀 User discover_step migration down - cannot be safely undone");
  logInfo("This migration sets default discover_step for users who were missing it");
  logInfo("To undo, you would need to manually identify which users originally had no discover_step");
}

module.exports = { up, down };
