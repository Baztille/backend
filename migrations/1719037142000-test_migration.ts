import { logInfo } from "src/utils/logger";

/**
 * Make any changes you need to make to the database here
 */
async function up() {
  // Write migration here
  logInfo("🚀🚀 Test migration - up");
}

/**
 * Make any changes that UNDO the up function side effects here (if possible)
 */
async function down() {
  // Write migration here
  logInfo("🚀🚀 Test migration - down");
}

module.exports = { up, down };
