import csv from "csv-parser";
import * as fs from "fs";
import * as dotenv from "dotenv";
import { getModels } from "./migration.models";
import mongoose, { Types } from "mongoose";
import { TerritoryTypeMongo } from "src/countrymodel/schema/territory-type.schema";
import { logError, logInfo } from "src/utils/logger";
import { TerritoryMongo } from "src/countrymodel/schema/territory.schema";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

export async function up(): Promise<void> {
  logInfo("🚀🚀 Migration FR-import-polling-stations - up");

  if (process.env.COUNTRY == "FR") {
    logInfo("FRANCE detected: starting migration");
    const { TerritoryTypesModel } = await getModels();

    let territoryTypeToTypeId = await getTerritoryTypes();

    logInfo("TerritoryMongo types:");
    logInfo(territoryTypeToTypeId);

    // Load polling stations infos
    let pollingStationInfos = await loadPollingStationsInfos();

    // Set postal codes for Communes
    setPostalCodes();

    // Start to import polling stations
    if (!territoryTypeToTypeId["Polling Station"]) {
      throw new Error("Cannot find 'Polling Station' basic territory type");
    }
    await importPollingStations(pollingStationInfos);
  }
}

export async function down(): Promise<void> {
  logInfo("🚀🚀 Migration FR-import-polling-stations - down");

  if (process.env.COUNTRY == "FR") {
    logInfo("FRANCE detected: starting DOWN migration");

    if (process.env.COUNTRY == "FR") {
      let territoryTypeToTypeId = await getTerritoryTypes();

      const { TerritoryModel } = await getModels();
      await TerritoryModel.deleteMany({ type: territoryTypeToTypeId["Polling Station"] });
    }
  }
}

//////////////////////////////////////////////////
///// UTILITIES

async function getTerritoryTypes() {
  const { TerritoryTypesModel } = await getModels();
  let territoryTypes = await TerritoryTypesModel.find({}, { _id: true, name: true });

  // Build types => type_id
  let territoryTypeToTypeId = {};
  for (let i in territoryTypes) {
    territoryTypeToTypeId[territoryTypes[i].name] = territoryTypes[i]._id;
  }

  return territoryTypeToTypeId;
}

// Create cleanname based on name:
//  - only a-z or 0-9 or space
//  - accents/special letter are replaced with nearest letter (ex: à => a)
//  - other characters are replaced with space (ex: ' => space)
// Note: used for text based search
function createCleanName(territory_name) {
  // Remove accents
  let clean_name = territory_name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // see https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript

  clean_name = clean_name.toLowerCase();

  clean_name = clean_name.replace(/[\W_]+/g, " ");

  return clean_name;
}

async function getTerritoryTypeCodeToID(territory_type_id) {
  const { TerritoryModel } = await getModels();

  // Build dpt code => dpt ID list
  let territories = await TerritoryModel.find({ type: territory_type_id }, { _id: true, officialCode: true });
  let codeToID = {};
  for (let i in territories) {
    const official_code = territories[i].officialCode;
    if (official_code) {
      codeToID[official_code] = territories[i]._id;
    }
  }

  return codeToID;
}

async function getCommunesNotEntirelyInCirconscription() {
  // Return the list of all communes that are not entirely contained in a circonscription
  // (either because there are divided into several circonscriptions (ex: "Paris case")
  //  or because parts of the commune belongs to different circonscriptions (ex: "Nanterre case")

  const { TerritoryModel } = await getModels();
  let territoryTypes = await getTerritoryTypes();
  let communes = await TerritoryModel.find(
    {
      type: territoryTypes["Commune"]
    },
    { _id: 1 }
  ).populate({
    path: "parents",
    select: "type",
    match: { type: { $eq: territoryTypes["Département"] } } // note: communes not in circonscription depends on their "département"
  });

  let result = [];
  for (let i in communes) {
    if (communes[i].parents.length > 0) {
      result[communes[i]._id.toString()] = true;
    }
  }

  return result;
}

async function loadPollingStationsInfos() {
  return new Promise(async function (resolve, reject) {
    try {
      const stations = {};

      // Read the CSV file
      fs.createReadStream("./migrations/files/FR/table-bv-reu.csv")
        .pipe(csv({ separator: "," }))
        .on("data", async (row) => {
          let address = "";
          if (row["num_voie_reu"] && parseInt(row["num_voie_reu"]) != 0) {
            address += row["num_voie_reu"].trim() + " ";
          }
          address += row["voie_reu"].trim();

          let index_station = row["id_brut_miom"];

          if (index_station[0] == "Z") {
            // For "outre mer", we should rebuild this index
            const zeroPad = (num, places) => String(num).padStart(places, "0");
            index_station =
              zeroPad(row["code_commune"].trim().replace(/^0+/, ""), 5) +
              "_" +
              zeroPad(row["code"].replace(/^0+/, ""), 4);
          }

          stations[index_station] = {
            name: row["libelle_reu"],
            address: address.trim()
          };
        })
        .on("end", async () => {
          resolve(stations);
        });
    } catch (error) {
      logError("🚀 Error getting polling stations infos:", error);
      reject();
    }
  });
}

async function setPostalCodes() {
  return new Promise(async function (resolve, reject) {
    logInfo("Importing Postal codes (FR)");
    let territoryTypeToTypeId = await getTerritoryTypes();
    const { TerritoryModel } = await getModels();

    try {
      const communesToPostalCode = {
        // Note: set manually Paris/Lyon/Marseille because it does not work below (because of Arrondissements)
        75056: [
          75001, 75002, 75003, 75004, 75005, 75006, 75007, 75008, 75009, 75010, 75011, 75012, 75013, 75014, 75015,
          75016, 75017, 75018, 75019, 75020
        ],
        13055: [
          13001, 13002, 13003, 13004, 13005, 13006, 13007, 13008, 13009, 13010, 13011, 13012, 13013, 13014, 13015, 13016
        ],
        69123: [69001, 69002, 69003, 69004, 69005, 69006, 69007, 69008, 69009]
      };
      let communes_nbr = 0;
      let postal_codes_nbr = 0;

      // Read the CSV file
      fs.createReadStream("./migrations/files/FR/table-bv-reu.csv")
        .pipe(csv({ separator: "," }))
        .on("data", async (row) => {
          let postalCode = row["cp_reu"];
          let communeCode = row["code_commune"];

          if (!communesToPostalCode[communeCode]) {
            communesToPostalCode[communeCode] = [];
            communes_nbr++;
          }

          if (communesToPostalCode[communeCode].includes(postalCode)) {
            // Already added
          } else {
            communesToPostalCode[communeCode].push(postalCode);
            postal_codes_nbr++;
          }
        })
        .on("end", async () => {
          let communeCodeToID = await getTerritoryTypeCodeToID(territoryTypeToTypeId["Commune"]);

          logInfo("Setting " + postal_codes_nbr + " postal codes for " + communes_nbr + " communes ");

          for (let commune_code in communesToPostalCode) {
            if (communeCodeToID[commune_code]) {
              let commune_id = communeCodeToID[commune_code];
              let postal_codes = communesToPostalCode[commune_code].join(",");

              await TerritoryModel.updateOne({ _id: commune_id }, { $set: { shortname: postal_codes } });
            }
          }

          resolve(communesToPostalCode);
        });
    } catch (error) {
      logError("🚀 Error getting polling stations infos:", error);
      reject();
    }
  });
}

async function importPollingStations(pollingStationInfos) {
  logInfo("Importing Polling Stations (FR)");

  let territoryTypeToTypeId = await getTerritoryTypes();

  return new Promise(async function (resolve, reject) {
    const { TerritoryModel } = await getModels();

    try {
      const stations: TerritoryMongo[] = [];

      // Build commune code => ID list
      let communeCodeToID = await getTerritoryTypeCodeToID(territoryTypeToTypeId["Commune"]);

      // Build circo code => ID list
      let circoCodeToID = await getTerritoryTypeCodeToID(territoryTypeToTypeId["Circonscription"]);

      // Build arrondissement code => ID list
      let arrondissementCodeToID = await getTerritoryTypeCodeToID(territoryTypeToTypeId["Arrondissement"]);

      logInfo("Arrondissements list");
      logInfo(arrondissementCodeToID);

      let communesNotEntirelyInCirconscription = await getCommunesNotEntirelyInCirconscription();

      let missingInfosErrorNbr = 0;
      let noParentCommuneErrorNbr = 0;
      let noParentCircoErrorNbr = 0;

      // Get ID of Paris/Lyon/Marseille (cities with arrondissements)
      let communeWithArrondissement = [
        communeCodeToID[75056], // Paris
        communeCodeToID[69123], // Lyon
        communeCodeToID[13055] // Marseille
      ];

      // Read the CSV file
      fs.createReadStream("./migrations/files/FR/bureaux-de-vote-circonscriptions.csv")
        .pipe(csv({ separator: "," }))
        .on("data", async (row) => {
          let parents: MongooseSchema.Types.ObjectId[] = [];
          let commune_id = communeCodeToID[row["codeCommune"]];
          let polling_station_no = parseInt(row["codeBureauVote"].split("_")[1].slice(-2));
          if (commune_id) {
            if (!communeWithArrondissement.includes(commune_id)) {
              // regular, simple case
              parents.push(commune_id);
            } else {
              // We are at Paris/Lyon/Marseille => circo should be child of the arrondissement
              let arrondissement_no = parseInt(row["codeBureauVote"].split("_")[1].substring(0, 2));
              let arrondissement_code = row["codeCommune"] + "_" + arrondissement_no;

              if (arrondissementCodeToID[arrondissement_code]) {
                parents.push(arrondissementCodeToID[arrondissement_code]);
              } else {
                logInfo("CANNOT FIND arrondissement in this case: ");
              }
            }
          } else {
            logInfo("No parent commune for station: " + row["nomCommune"] + " " + row["numeroBureauVote"]);
            noParentCommuneErrorNbr++;
          }

          //logInfo("commune id = "+commune_id);

          // Commune should be the only parent for Polling Station ...
          // EXCEPT:
          // _ "Paris case": when the commune is divided into circonscriptions, polling stations should have a parent/child link with circos
          // _ "Nanterre case": when the commune is splitted into several circonscriptions, polling stations should have a parent/child link with circos
          // In both of these case, the "commune => polling station" link is used for local city decisions,
          //    while the "circonscription => polling station" link is used for the national decisions.
          // To determine if we are in one of these case, we check if commune has a circonscription has parent

          if (commune_id && communesNotEntirelyInCirconscription[commune_id]) {
            // This is the EXCEPT case above => add the circo as parent to the polling station too

            //logInfo("Detected a commune for which we should add the polling station as child");

            // Build circo code (compatible with existing data) /////////:

            // Take 2 last digits of "codeCirconscription" => gives the circonscription number
            let circoNumber = row["codeCirconscription"].slice(-2);

            // Take the departement number
            let dpt_number = row["codeDepartement"];
            let circo_code = dpt_number + "0" + circoNumber;

            if (dpt_number[0] == "Z") {
              // This is "outre mer" departement => specific treatment
              dpt_number = row["codeBureauVote"].slice(0, 3);
              circo_code = dpt_number + circoNumber; // Note: in this specific case, dpt_number is 3 digits
            }

            if (circoCodeToID[circo_code]) {
              parents.push(circoCodeToID[circo_code]);
            } else {
              logInfo(
                "No parent circo for station " +
                  row["nomCommune"] +
                  " " +
                  row["numeroBureauVote"] +
                  " (circo_code = " +
                  circo_code +
                  "):"
              );
              noParentCircoErrorNbr++;
            }
          }

          let polling_station_name = "Bureau n°" + polling_station_no;

          // get additional station infos
          const zeroPad = (num, places) => String(num).padStart(places, "0");
          let station_insee_code =
            zeroPad(row["codeCommune"].trim().replace(/^0+/, ""), 5) +
            "_" +
            zeroPad(row["numeroBureauVote"].replace(/^0+/, ""), 4);
          if (pollingStationInfos[station_insee_code]) {
            polling_station_name +=
              ": " +
              pollingStationInfos[station_insee_code].name +
              " (" +
              pollingStationInfos[station_insee_code].address +
              ")";
          } else {
            logInfo(
              "Missing additional infos for this polling station: " +
                row["nomCommune"] +
                " " +
                row["numeroBureauVote"] +
                " insee_code: " +
                station_insee_code
            );
            missingInfosErrorNbr++;
          }

          polling_station_name += " " + row["nomCommune"];

          let station: TerritoryMongo = {
            _id: new mongoose.Types.ObjectId().toString(),
            name: polling_station_name,
            cleanname: createCleanName(polling_station_name),
            type: territoryTypeToTypeId["Polling Station"],
            active: true,
            officialCode: row["codeBureauVote"],
            parents: parents,
            subdivisions: [],
            routeTo: new Map<string, [string]>()
          };

          stations.push(station);
        })
        .on("end", async () => {
          // Insert data into the database
          const bulkOperations = stations.map((item) => ({
            updateOne: {
              filter: { _id: item._id },
              update: { $set: item },
              upsert: true
            }
          }));

          await TerritoryModel.bulkWrite(bulkOperations);
          logInfo("🚀 " + stations.length + " polling stations have been successfully inserted into the database.");

          logInfo(
            "Errors summary: " +
              missingInfosErrorNbr +
              " missing infos / " +
              noParentCircoErrorNbr +
              " no parent circo / " +
              noParentCommuneErrorNbr +
              " no parent commune"
          );

          // Adding polling stations as circo/commune children
          logInfo("Adding polling stations as circo/commune/arrondissement children...");
          var stations_processed_number = 0;
          for (let i in stations) {
            if (stations_processed_number % 1000 == 0) {
              logInfo(stations_processed_number + " polling stations processed");
            }

            stations_processed_number++;
            for (let parent_index in stations[i].parents) {
              await TerritoryModel.findOneAndUpdate(
                {
                  _id: stations[i].parents[parent_index]
                },
                {
                  $push: {
                    subdivisions: {
                      subdivisionId: stations[i]._id,
                      main_subdivision: true
                    }
                  }
                }
              );
            }
          }

          resolve(true);
        });
    } catch (error) {
      logError("🚀 Error inserting polling stations:", error);
      reject();
    }
  });
}
