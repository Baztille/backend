import * as dotenv from "dotenv";
import { getModels } from "./migration.models";
import { logInfo } from "src/utils/logger";

export async function up(): Promise<void> {
  logInfo("🚀🚀 Migration FR-create-territory-types - up");

  if (process.env.COUNTRY == "FR") {
    logInfo("FRANCE detected: starting migration");
    const { TerritoryTypesModel } = await getModels();

    await new TerritoryTypesModel({
      name: "Région",
      display_weight: 90
    }).save();

    await new TerritoryTypesModel({
      name: "Département",
      display_weight: 70
    }).save();

    await new TerritoryTypesModel({
      name: "Circonscription",
      display_weight: 60
    }).save();

    await new TerritoryTypesModel({
      name: "Communauté de communes",
      display_weight: 50
    }).save();

    await new TerritoryTypesModel({
      name: "Canton",
      display_weight: 45
    }).save();

    await new TerritoryTypesModel({
      name: "Commune",
      display_weight: 40
    }).save();

    await new TerritoryTypesModel({
      name: "Arrondissement",
      display_weight: 20
    }).save();
  }
}

export async function down(): Promise<void> {
  logInfo("🚀🚀 Migration FR-create-territory-types - down");

  if (process.env.COUNTRY == "FR") {
    const { TerritoryModel, TerritoryTypesModel } = await getModels();
    await TerritoryModel.deleteMany();
    await TerritoryTypesModel.deleteMany({
      name: {
        $in: [
          "Région",
          "Département",
          "Circonscription",
          "Communauté de communes",
          "Canton",
          "Commune",
          "Arrondissement"
        ]
      }
    });
  }
}
