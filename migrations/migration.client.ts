import { logError, logInfo } from "src/utils/logger";
import Migrator from "ts-migrate-mongoose";

export class MigrationClient {
  static async run() {
    const migrator = await Migrator.connect({
      uri: process.env.DB_CONNECT ?? "mongodb://127.0.0.1:27017/baztille_db",
      autosync: true
    });

    logInfo("🚀🚀🚀 Running migrations...");

    await migrator
      .run("up")
      .then((migrations) => {
        for (const migration of migrations) {
          logInfo("up:", migration.filename);
        }
      })
      .catch((error) => {
        logError("🚀 Error during migration (up):");
        logError(error);
      });

    await migrator.close();

    logInfo("🚀🚀🚀 ... end of migrations");
  }
}
