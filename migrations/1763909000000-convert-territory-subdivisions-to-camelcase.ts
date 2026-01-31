import { logInfo } from "src/utils/logger";
import mongoose from "mongoose";
import { getMongoose } from "./migration.models";

/**
 * Convert territory subdivisions array properties from snake_case to camelCase
 * This migration specifically updates the subdivisions array in c_territory collection
 *
 * Property mappings within subdivisions array:
 * - main_subdivision -> mainSubdivision
 * - subdivision_id -> subdivisionId
 */

async function up() {
  logInfo("🚀🚀 Converting territory subdivisions properties from snake_case to camelCase...");

  const db = (await getMongoose()).connection.db;
  const collection = db.collection("c_territory");

  // Find all territories with subdivisions
  const territories = await collection
    .find({
      subdivisions: { $exists: true, $ne: [] }
    })
    .toArray();

  logInfo(`Found ${territories.length} territories with subdivisions to update`);

  let totalUpdated = 0;

  for (const territory of territories) {
    if (!territory.subdivisions || !Array.isArray(territory.subdivisions)) {
      continue;
    }

    // Transform each subdivision in the array
    const updatedSubdivisions = territory.subdivisions.map((subdivision: any) => {
      const updated: any = { ...subdivision };

      // Rename main_subdivision to mainSubdivision
      if ("main_subdivision" in subdivision) {
        updated.mainSubdivision = subdivision.main_subdivision;
        delete updated.main_subdivision;
      }

      // Rename subdivision_id to subdivisionId
      if ("subdivision_id" in subdivision) {
        updated.subdivisionId = subdivision.subdivision_id;
        delete updated.subdivision_id;
      }

      return updated;
    });

    // Update the document with the transformed subdivisions array
    await collection.updateOne({ _id: territory._id }, { $set: { subdivisions: updatedSubdivisions } });

    totalUpdated++;
  }

  logInfo(`✅ Territory subdivisions conversion completed. Total territories updated: ${totalUpdated}`);
}

async function down() {
  logInfo("🚀🚀 Reverting territory subdivisions properties back to snake_case...");

  const db = (await getMongoose()).connection.db;
  const collection = db.collection("c_territory");

  // Find all territories with subdivisions
  const territories = await collection
    .find({
      subdivisions: { $exists: true, $ne: [] }
    })
    .toArray();

  logInfo(`Found ${territories.length} territories with subdivisions to revert`);

  let totalReverted = 0;

  for (const territory of territories) {
    if (!territory.subdivisions || !Array.isArray(territory.subdivisions)) {
      continue;
    }

    // Transform each subdivision in the array back to snake_case
    const revertedSubdivisions = territory.subdivisions.map((subdivision: any) => {
      const reverted: any = { ...subdivision };

      // Rename mainSubdivision back to main_subdivision
      if ("mainSubdivision" in subdivision) {
        reverted.main_subdivision = subdivision.mainSubdivision;
        delete reverted.mainSubdivision;
      }

      // Rename subdivisionId back to subdivision_id
      if ("subdivisionId" in subdivision) {
        reverted.subdivision_id = subdivision.subdivisionId;
        delete reverted.subdivisionId;
      }

      return reverted;
    });

    // Update the document with the reverted subdivisions array
    await collection.updateOne({ _id: territory._id }, { $set: { subdivisions: revertedSubdivisions } });

    totalReverted++;
  }

  logInfo(`✅ Territory subdivisions reversion completed. Total territories reverted: ${totalReverted}`);
}

module.exports = { up, down };
