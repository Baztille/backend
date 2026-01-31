import csv from "csv-parser";
import * as fs from "fs";
import mongoose, { Schema as MongooseSchema } from "mongoose";
import { TerritoryMongo } from "src/countrymodel/schema/territory.schema";
import { COUNTRY_TERRITORY_ID } from "src/countrymodel/types/territory.type";
import { logError, logInfo } from "src/utils/logger";
import { getModels } from "./migration.models";

export async function up(): Promise<void> {
  logInfo("🚀🚀 Migration FR-import-territories - up");

  if (process.env.COUNTRY == "FR") {
    logInfo("FRANCE detected: starting migration");
    const { TerritoryTypesModel } = await getModels();

    const territoryTypes = await TerritoryTypesModel.find({}, { _id: true, name: true });

    // Build types => type_id
    const territoryTypeToTypeId: Record<string, string> = {};
    for (const i in territoryTypes) {
      territoryTypeToTypeId[territoryTypes[i].name] = territoryTypes[i]._id;
    }

    logInfo("TerritoryMongo types:");
    logInfo(territoryTypeToTypeId);

    // Create country territory
    if (!territoryTypeToTypeId["Country"]) {
      throw new Error("Cannot find 'Country' basic territory type");
    }
    const country_id = await createCountry(territoryTypeToTypeId["Country"]);

    // Regions
    if (!territoryTypeToTypeId["Région"]) {
      throw new Error("Cannot find 'Région' territory type");
    }
    await importRegions(country_id, territoryTypeToTypeId["Région"]);

    logInfo("After importRegions");

    // Departements
    if (!territoryTypeToTypeId["Département"]) {
      throw new Error("Cannot find 'Département' territory type");
    }
    await importDepartements(territoryTypeToTypeId["Région"], territoryTypeToTypeId["Département"]);

    // Communes
    if (!territoryTypeToTypeId["Commune"]) {
      throw new Error("Cannot find 'Commune' territory type");
    }
    await importCommunes(territoryTypeToTypeId["Département"], territoryTypeToTypeId["Commune"]);

    // Arrondissements
    if (!territoryTypeToTypeId["Arrondissement"]) {
      throw new Error("Cannot find 'Arrondissement' territory type");
    }
    await createArrondissements(territoryTypeToTypeId["Arrondissement"], territoryTypeToTypeId["Commune"]);

    // Circonscriptions
    if (!territoryTypeToTypeId["Circonscription"]) {
      throw new Error("Cannot find 'Circonscription' territory type");
    }
    await importCirconscriptions(
      territoryTypeToTypeId["Circonscription"],
      territoryTypeToTypeId["Département"],
      territoryTypeToTypeId["Commune"]
    );
  }
}

export async function down(): Promise<void> {
  logInfo("🚀🚀 Migration FR-create-territory-types - down");

  if (process.env.COUNTRY == "FR") {
    logInfo("FRANCE detected: starting DOWN migration");

    if (process.env.COUNTRY == "FR") {
      const { TerritoryModel } = await getModels();
      await TerritoryModel.deleteMany();
    }
  }
}

//////////////////////////////////////////////////
///// UTILITIES

async function getTerritoryTypeCodeToID(territory_type_id: string): Promise<Record<string, string>> {
  const { TerritoryModel } = await getModels();

  // Build dpt code => dpt ID list
  const territories = await TerritoryModel.find({ type: territory_type_id }, { _id: true, officialCode: true });
  const codeToID: Record<string, string> = {};
  for (const i in territories) {
    const official_code = territories[i].officialCode;
    if (official_code) {
      codeToID[official_code] = territories[i]._id;
    }
  }

  return codeToID;
}

// Create cleanname based on name:
//  - only a-z or 0-9 or space
//  - accents/special letter are replaced with nearest letter (ex: à => a)
//  - other characters are replaced with space (ex: ' => space)
// Note: used for text based search
function createCleanName(territory_name: string): string {
  // Remove accents
  let clean_name = territory_name.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // see https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript

  clean_name = clean_name.toLowerCase();

  clean_name = clean_name.replace(/[\W_]+/g, " ");

  return clean_name;
}

//////////////////////////////////////////////////
///// CREATE TERRITORIES METHODS

async function createCountry(country_type_id: string): Promise<string> {
  logInfo("Creating country root element (FR)");

  const { TerritoryModel } = await getModels();

  const country = new TerritoryModel({
    _id: COUNTRY_TERRITORY_ID,
    name: "France",
    cleanname: createCleanName("France"),
    type: country_type_id,
    active: true
  });
  await country.save();

  return COUNTRY_TERRITORY_ID;
}

async function importRegions(country_id: string, region_type_id: string) {
  logInfo("Importing regions (FR)");

  return new Promise(async function (resolve, reject) {
    const { TerritoryModel } = await getModels();

    try {
      const regions: TerritoryMongo[] = [];

      // Read the CSV file
      fs.createReadStream("./migrations/files/FR/regions-et-collectivites-doutre-mer-france@toursmetropole.csv")
        .pipe(csv({ separator: ";" }))
        .on("data", async (row) => {
          const region: TerritoryMongo = {
            _id: new mongoose.Types.ObjectId().toString(),
            name: row["Nom Officiel Région"],
            cleanname: createCleanName(row["Nom Officiel Région"]),
            type: new MongooseSchema.Types.ObjectId(region_type_id),
            active: true,
            officialCode: row["Code Officiel Région"],
            parents: [new MongooseSchema.Types.ObjectId(country_id)],
            subdivisions: [],
            routeTo: new Map<string, [string]>()
          };

          regions.push(region);
          //logInfo( region );
        })
        .on("end", async () => {
          // Insert data into the database
          const bulkOperations = regions.map((item) => ({
            updateOne: {
              filter: { _id: item._id },
              update: { $set: item },
              upsert: true
            }
          }));

          await TerritoryModel.bulkWrite(bulkOperations);
          logInfo("🚀 " + regions.length + " regions have been successfully inserted into the database.");

          // Adding regions as country children
          for (const i in regions) {
            //logInfo( "add child "+regions[i]._id);
            await TerritoryModel.findOneAndUpdate(
              { _id: country_id },
              {
                $push: {
                  subdivisions: {
                    subdivisionId: regions[i]._id,
                    main_subdivision: true
                  }
                }
              }
            );
          }

          resolve(true);
        });
    } catch (error) {
      logError("🚀 Error inserting regions:", error);
      reject();
    }
  });
}

async function importDepartements(region_type_id, departement_type_id) {
  logInfo("Importing departements (FR)");

  return new Promise(async function (resolve, reject) {
    const { TerritoryModel } = await getModels();

    try {
      const departements: TerritoryMongo[] = [];

      // Build region code => region ID list
      const regionCodeToID = await getTerritoryTypeCodeToID(region_type_id);

      // Read the CSV file
      fs.createReadStream("./migrations/files/FR/departements-et-collectivites-doutre-mer-france@toursmetropole.csv")
        .pipe(csv({ separator: ";" }))
        .on("data", async (row) => {
          //logInfo(row);

          const region_parent = regionCodeToID[row["Code Officiel Région"]];

          //logInfo("For "+row["Nom Officiel Département"]+" we found ",region_parent);

          if (!region_parent) {
            throw Error(
              "Cannot find parent region for Departement " +
                row["Nom Officiel Département"] +
                " with region code " +
                row["Code Officiel Région"]
            );
          }

          const departement: TerritoryMongo = {
            _id: new mongoose.Types.ObjectId().toString(),
            name: row["Nom Officiel Département"],
            cleanname: createCleanName(row["Nom Officiel Département"]),
            type: departement_type_id,
            active: true,
            officialCode: row["Code Officiel Département"],
            shortname: row["Code Officiel Département"],
            parents: [new MongooseSchema.Types.ObjectId(region_parent)],
            subdivisions: [],
            routeTo: new Map<string, [string]>()
          };

          departements.push(departement);
          //logInfo( departement );
        })
        .on("end", async () => {
          // Insert data into the database
          const bulkOperations = departements.map((item) => ({
            updateOne: {
              filter: { _id: item._id },
              update: { $set: item },
              upsert: true
            }
          }));

          //logInfo( bulkOperations );

          await TerritoryModel.bulkWrite(bulkOperations);
          logInfo("🚀 " + departements.length + " departements have been successfully inserted into the database.");

          // Adding departement as region children
          for (const i in departements) {
            await TerritoryModel.findOneAndUpdate(
              {
                _id: departements[i].parents[0]
              },
              {
                $push: {
                  subdivisions: {
                    subdivisionId: departements[i]._id,
                    main_subdivision: true
                  }
                }
              }
            );
          }

          resolve(true);
        });
    } catch (error) {
      logError("🚀 Error inserting departements:", error);
      reject();
    }
  });
}

async function importCommunes(departement_type_id, commune_type_id) {
  logInfo("Importing communes (FR)");

  return new Promise(async function (resolve, reject) {
    const { TerritoryModel } = await getModels();

    try {
      const communes: TerritoryMongo[] = [];
      const circos = [];
      const communes_code_to_id = {};

      // Build dpt code => dpt ID list
      const departementCodeToID = await getTerritoryTypeCodeToID(departement_type_id);

      // Read the CSV file
      fs.createReadStream("./migrations/files/FR/circo_composition.csv")
        .pipe(csv({ separator: ";" }))
        .on("data", async (row) => {
          //logInfo(row);

          if (communes_code_to_id[row["COMMUNE_RESID"]]) {
            // We already added this commune
          } else {
            // Add this commune

            const dpt_parent = departementCodeToID[row["DEP"]];

            //logInfo("For "+row["LIBcom"]+" we found ",dpt_parent);

            if (!dpt_parent) {
              throw Error("Cannot find parent departement for " + row["LIBcom"] + " with dpt code " + row["DEP"]);
            }

            const commune: TerritoryMongo = {
              _id: new mongoose.Types.ObjectId().toString(),
              name: row["LIBcom"],
              cleanname: createCleanName(row["LIBcom"]),
              type: commune_type_id,
              active: true,
              officialCode: row["COMMUNE_RESID"],
              parents: [],
              subdivisions: [],
              routeTo: new Map<string, [string]>()
            };

            communes.push(commune);
            //logInfo( departement );

            communes_code_to_id[row["COMMUNE_RESID"]] = commune._id;
          }
        })
        .on("end", async () => {
          // Insert data into the database
          const bulkOperations = communes.map((item) => ({
            updateOne: {
              filter: { _id: item._id },
              update: { $set: item },
              upsert: true
            }
          }));

          await TerritoryModel.bulkWrite(bulkOperations);
          logInfo("🚀 " + communes.length + " communes have been successfully inserted into the database.");

          // Adding communes as departement children
          // Note: we prefer add communes as circonscription children if possible
          /*logInfo( "Adding communes as departement children..." );
          for( let i in communes )
          {
              if( parseInt(i) % 1000 == 0)
              {
                  logInfo( i+" communes processed...");
              }
              await TerritoryModel.findOneAndUpdate( { 
                _id: communes[i].parents[0] 
              }, {
                $push: {
                  subdivisions: { 
                    subdivisionId: communes[i]._id,
                    main_subdivision: false // Note: main subdivisions for departements are circonscriptions
                  }
                }
                
              } );  
          }*/

          resolve(true);
        });
    } catch (error) {
      logError("🚀 Error inserting communes:", error);
      reject();
    }
  });
}

async function createArrondissements(arrondissement_type_id, commune_type_id) {
  logInfo("Creating arrondissements (Paris/Lyon/Marseille) (FR)");

  const { TerritoryModel } = await getModels();

  const arrondissement_config = {
    Paris: {
      code_commune: 75056,
      arrondissement_nbr: 20
    },
    Lyon: {
      code_commune: 69123,
      arrondissement_nbr: 9
    },
    Marseille: {
      code_commune: 13055,
      arrondissement_nbr: 16
    }
  };

  const zeroPad = (num, places) => String(num).padStart(places, "0");

  for (const commune in arrondissement_config) {
    logInfo("Creating arrondissements for " + commune);

    const commune_id_raw = await TerritoryModel.findOne(
      { type: commune_type_id, officialCode: arrondissement_config[commune].code_commune },
      { _id: true }
    );
    if (!commune_id_raw) {
      logInfo("ERROR: cannot find commune with code " + arrondissement_config[commune].code_commune);
      return;
    }
    const commune_id = commune_id_raw._id;

    // Add arrondissements
    for (
      let arrondissement_no = 1;
      arrondissement_no <= arrondissement_config[commune].arrondissement_nbr;
      arrondissement_no++
    ) {
      let arrondissement_name = arrondissement_no + "e arrondissement";
      if (arrondissement_no == 1) {
        arrondissement_name = "1er arrondissement";
      }

      const arrondissement_code = arrondissement_config[commune].code_commune + "_" + arrondissement_no;

      const arrondissement = {
        _id: new mongoose.Types.ObjectId(),
        name: arrondissement_name,
        cleanname: createCleanName(arrondissement_name),
        type: arrondissement_type_id,
        active: true,
        officialCode: arrondissement_code,
        parents: [commune_id]
      };

      await new TerritoryModel(arrondissement).save();

      // Then, add arrondissement as (main subdivision) of parent commune
      await TerritoryModel.findOneAndUpdate(
        {
          _id: commune_id
        },
        {
          $push: {
            subdivisions: {
              subdivisionId: arrondissement._id,
              main_subdivision: true // Note: main subdivisions for communes are arrondissements
            }
          }
        }
      );
    }
  }
}

async function importCirconscriptions(circonscription_type_id, departement_type_id, commune_type_id) {
  logInfo("Importing circonscriptions (FR)");

  return new Promise(async function (resolve, reject) {
    const { TerritoryModel } = await getModels();

    try {
      const circos: TerritoryMongo[] = [];
      const circos_code_to_id = {};
      const circo_to_communes = {}; // Circo to list of communes, with relationship (entirely contains or partially contains),
      // to build parent/children links between circos and communes

      // Build dpt code => dpt ID list
      const departementCodeToID = await getTerritoryTypeCodeToID(departement_type_id);

      // Build commune code => dpt ID list
      const communeCodeToID = await getTerritoryTypeCodeToID(commune_type_id);

      // Read the CSV file
      fs.createReadStream("./migrations/files/FR/circo_composition.csv")
        .pipe(csv({ separator: ";" }))
        .on("data", async (row) => {
          //logInfo(row);
          const dpt_parent = departementCodeToID[row["DEP"]];

          if (circos_code_to_id[row["circo"]]) {
            // We already added this circo
          } else {
            // Add this circo

            //logInfo("For circo "+row["circo"]+" we found ",dpt_parent);

            if (!dpt_parent) {
              throw Error("Cannot find parent departement for circo " + row["circo"] + " with dpt code " + row["DEP"]);
            }

            // Build circonscription name
            // ex: "12e circonscription - Hauts-de-Seine"
            const circo_number = parseInt(row["circo"].slice(-2));
            let circo_name = circo_number + "";
            if (circo_number == 1) {
              circo_name += "ère";
            } else if (circo_number == 2) {
              circo_name += "nde";
            } else {
              circo_name += "e";
            }

            circo_name += " circonscription - ";
            circo_name += row["libdep"];

            const circo: TerritoryMongo = {
              _id: new mongoose.Types.ObjectId().toString(),
              name: circo_name,
              cleanname: createCleanName(circo_name),
              type: circonscription_type_id,
              active: true,
              officialCode: row["circo"],
              parents: [new MongooseSchema.Types.ObjectId(dpt_parent)],
              subdivisions: [],
              routeTo: new Map<string, [string]>()
            };

            circos.push(circo);
            //logInfo( circo );

            circos_code_to_id[row["circo"]] = circo._id;
          }

          if (!circo_to_communes[row["circo"]]) {
            circo_to_communes[row["circo"]] = [];
          }

          circo_to_communes[row["circo"]].push({
            commune: row["COMMUNE_RESID"],
            dpt: dpt_parent,
            entire_commune: row["type_com"] == "entière"
          });
        })
        .on("end", async () => {
          // Insert data into the database
          const bulkOperations = circos.map((item) => ({
            updateOne: {
              filter: { _id: item._id },
              update: { $set: item },
              upsert: true
            }
          }));

          await TerritoryModel.bulkWrite(bulkOperations);
          logInfo("🚀 " + circos.length + " circonscriptions have been successfully inserted into the database.");

          // Adding circos as departement children
          logInfo("Adding circos as departement children...");
          for (const i in circos) {
            await TerritoryModel.findOneAndUpdate(
              {
                _id: circos[i].parents[0]
              },
              {
                $push: {
                  subdivisions: {
                    subdivisionId: circos[i]._id,
                    main_subdivision: true // Note: main subdivisions for departements are circonscriptions
                  }
                }
              }
            );
          }

          logInfo("Building circos/communes parent/children links...");
          let circo_processed_number = 0;
          for (const circo_code in circo_to_communes) {
            circo_processed_number++;
            if (circo_processed_number % 100 == 0) {
              logInfo(circo_processed_number + " circonscriptions processed");
            }

            /*if( circo_code.slice(0,2)!='92')
            {
                          // for dev, focus on 75   
            }
            else
            {*/

            for (const commune_index in circo_to_communes[circo_code]) {
              const commune = circo_to_communes[circo_code][commune_index];
              //logInfo( commune );
              const commune_id = communeCodeToID[commune["commune"]];
              const dpt_id = commune["dpt"];
              const circo_id = circos_code_to_id[circo_code];

              if (commune["entire_commune"]) {
                //logInfo("The whole commune "+commune_id+" is included in circo "+circo_id );

                // This whole commune is contained in the circonscription => commune should be the children of the circonscription
                await TerritoryModel.findOneAndUpdate(
                  {
                    _id: circo_id
                  },
                  {
                    $push: {
                      subdivisions: {
                        subdivisionId: commune_id,
                        main_subdivision: true // Note: in this case, main subdivisions for circonscriptions are commune
                      }
                    }
                  }
                );

                await TerritoryModel.findOneAndUpdate(
                  {
                    _id: commune_id
                  },
                  {
                    $push: {
                      parents: circo_id
                    }
                  }
                );
              } else {
                // Only a part of this commune is part of the circonscription
                // 2 possible cases:
                // - if another city is also part of the circonscription, then there are no possible children/parent links and
                //   commune's parent should be the departement.
                //   ex: Nanterre
                // - if no other city is part of the circonscription, then the circonscription is a part of the city and should be
                //   a children of the city.
                //   ex: Paris

                if (circo_to_communes[circo_code].length > 1) {
                  //logInfo("The circo "+circo_id+" is covering parts of several communes, so set these communes as child of dpt "+dpt_id );

                  // First case => set departement as commune's parent (if not done already)

                  var existing_commune = await TerritoryModel.findOne({ _id: commune_id }, "parents");
                  //logInfo("Check in:");
                  //logInfo( existing_commune );
                  if (existing_commune && existing_commune.parents.includes(dpt_id)) {
                    // Already added
                    //logInfo("Already added dpt as parent for this commune => skipping");
                  } else {
                    await TerritoryModel.findOneAndUpdate(
                      {
                        _id: dpt_id
                      },
                      {
                        $push: {
                          subdivisions: {
                            subdivisionId: commune_id,
                            main_subdivision: false // Note: main divisions for departement are circonscriptions
                          }
                        }
                      }
                    );

                    await TerritoryModel.findOneAndUpdate(
                      {
                        _id: commune_id
                      },
                      {
                        $push: {
                          parents: dpt_id
                        }
                      }
                    );
                  }
                } else {
                  //logInfo("The circo "+circo_id+" is a subdivision of commune "+commune_id );

                  // Second case => set commune as circonscription's parent + departement as commune's parent
                  await TerritoryModel.findOneAndUpdate(
                    {
                      _id: commune_id
                    },
                    {
                      $push: {
                        subdivisions: {
                          subdivisionId: circo_id,
                          main_subdivision: false // Note: circos are main divisions of the departement already
                        }
                      }
                    }
                  );

                  await TerritoryModel.findOneAndUpdate(
                    {
                      _id: circo_id
                    },
                    {
                      $push: {
                        parents: commune_id
                      }
                    }
                  );

                  var existing_commune = await TerritoryModel.findOne({ _id: commune_id }, "parents");
                  //logInfo("Check in:");
                  //logInfo( existing_commune );
                  if (existing_commune && existing_commune.parents.includes(dpt_id)) {
                    // Already added
                    //logInfo("Already added dpt as parent for this commune => skipping");
                  } else {
                    await TerritoryModel.findOneAndUpdate(
                      {
                        _id: dpt_id
                      },
                      {
                        $push: {
                          subdivisions: {
                            subdivisionId: commune_id,
                            main_subdivision: false // Note: main divisions for departement are circonscriptions
                          }
                        }
                      }
                    );

                    await TerritoryModel.findOneAndUpdate(
                      {
                        _id: commune_id
                      },
                      {
                        $push: {
                          parents: dpt_id
                        }
                      }
                    );
                  }
                }
              }
            }
            //}
          }

          resolve(true);
        });
    } catch (error) {
      logError("🚀 Error inserting circonscriptions:", error);
      reject();
    }
  });
}
