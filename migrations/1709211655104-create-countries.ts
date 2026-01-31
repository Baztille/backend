import csv from "csv-parser";
import * as fs from "fs";
import { getModels } from "./migration.models";
import { logError, logInfo } from "src/utils/logger";

export async function up() {
  const { CountryModel } = await getModels();
  logInfo("🚀🚀 Migration countries - up");

  try {
    const countries: any[] = [];
    // Read the CSV file
    fs.createReadStream("./migrations/files/baztille_db.countries.csv")
      .pipe(csv())
      .on("data", (row) => {
        countries.push(row);
      })
      .on("end", async () => {
        // Insert data into the database
        const bulkOperations = countries.map((country) => ({
          updateOne: {
            filter: { _id: country._id },
            update: { $set: country },
            upsert: true
          }
        }));

        await CountryModel.bulkWrite(bulkOperations);
        logInfo("🚀 " + countries.length + " countries have been successfully inserted into the database.");
      });
  } catch (error) {
    logError("🚀 Error inserting countries:", error);
  }
}

export async function down() {
  const { CountryModel } = await getModels();
  logInfo("🚀🚀 Migration countries - down ok");

  // Write migration here
  await CountryModel.deleteMany();
}
