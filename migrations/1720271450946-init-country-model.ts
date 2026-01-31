import { logInfo } from "src/utils/logger";
import { getModels } from "./migration.models";

export async function up(): Promise<void> {
  const { TerritoryModel, TerritoryTypesModel } = await getModels();
  logInfo("🚀🚀 Migration init-country-model - up");

  // Init country model: reset all country related data + import basic TerritoryTypes

  logInfo("Removing all country related tables");
  await TerritoryModel.deleteMany();
  await TerritoryTypesModel.deleteMany();

  // Insert basic territory types (Country and VotingStation)

  const country = {
    name: "Country",
    display_weight: 100
  };
  const pollingStation = {
    name: "Polling Station",
    display_weight: 0
  };

  await new TerritoryTypesModel(country).save();
  await new TerritoryTypesModel(pollingStation).save();

  logInfo("End init-country-model migration");
}

export async function down(): Promise<void> {
  logInfo("🚀🚀 Migration init-country-model - down");

  logInfo("Removing all country related tables");
  const { TerritoryModel, TerritoryTypesModel } = await getModels();
  await TerritoryModel.deleteMany();
  await TerritoryTypesModel.deleteMany();
}
