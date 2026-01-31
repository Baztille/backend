import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model } from "mongoose";
import { BaztilleChatMessageMedata } from "src/chat/chat.schema";
import { ChatService } from "src/chat/chat.service";
import { InternalEventsEnum } from "src/common/enum/internal-events.enum";
import { TerritoryTypeDocument, TerritoryTypeMongo } from "src/countrymodel/schema/territory-type.schema";
import { TerritoryDocument, TerritoryMongo, VotableTerritoryMongo } from "src/countrymodel/schema/territory.schema";
import { cronlogInfo, logDebug, logInfo } from "src/utils/logger";
import { TerritoryOrganizationUpdateDto } from "./dto/territory-organization-update.dto";
import { TerritorySearchResultDto } from "./dto/territory.dto";
import { COUNTRY_TERRITORY_ID, Territory } from "./types/territory.type";

@Injectable()
export class CountrymodelService {
  constructor(
    @InjectModel(TerritoryMongo.name) private readonly territoryModel: Model<TerritoryMongo>,
    @InjectModel(TerritoryTypeMongo.name) private readonly territoryTypeModel: Model<TerritoryTypeMongo>,
    private readonly eventEmitter: EventEmitter2,
    private readonly chatService: ChatService
  ) {}

  async getTerritory(territoryId?: string): Promise<Territory> {
    if (territoryId == "" || territoryId == null || territoryId == undefined) {
      territoryId = COUNTRY_TERRITORY_ID;
    }
    const territories = await this._getTerritoriesFromMongo({ _id: new mongoose.Types.ObjectId(territoryId) });
    if (territories.length == 0) {
      throw new Error(`Territory with ID ${territoryId} not found`);
    }
    const territory = territories[0];
    return territory;
  }

  async getTerritories(territoryArray: string[] | mongoose.ObjectId[]): Promise<Territory[]> {
    return this._getTerritoriesFromMongo({ _id: { $in: territoryArray }, active: true });
  }

  /*
   * Get all territories of the given type
   * @param {string} territoryTypeId - The territory type ID.
   * @param options - options object
   *  - bOnlyVotable: if true, only return votable territories
   * - withoutRouteTo: if provided, only return territories that do not have a route to the given territory type ID
   * @returns array of territories
   */
  async getTerritoriesFromType(
    territoryTypeId: string,
    options: { bOnlyVotable?: boolean; withoutRouteTo?: string }
  ): Promise<Territory[]> {
    let filter: mongoose.FilterQuery<TerritoryMongo> = {
      type: new mongoose.Types.ObjectId(territoryTypeId),
      active: true
    };
    if (options.bOnlyVotable) {
      filter = { ...filter, votableTerritory: { $exists: true } };
    }
    if (options.withoutRouteTo) {
      // routeTo.<withoutRouteTo> should not exist
      const field_name = "routeTo." + options.withoutRouteTo;
      filter = { ...filter, [field_name]: { $exists: false } };
    }

    return this._getTerritoriesFromMongo(filter);
  }

  async _getTerritoriesFromMongo(filter: mongoose.FilterQuery<TerritoryMongo>): Promise<Territory[]> {
    const territories: Territory[] | null = await this.territoryModel
      .find<TerritoryMongo>(filter)
      .populate<{ ["subdivisions.subdivisionId"]: TerritoryDocument }>({
        path: "subdivisions.subdivisionId",
        select: "name type",
        populate: {
          path: "type",
          model: "TerritoryTypeMongo",
          select: "name"
        }
      })
      .populate<{ parents: TerritoryDocument }>({
        path: "parents",
        select: "name type",
        populate: {
          path: "type",
          model: "TerritoryTypeMongo",
          select: "name"
        }
      })
      .populate<{ type: TerritoryTypeDocument }>("type", "name")
      .lean();

    if (!territories) {
      return [];
    }

    return territories;
  }

  /**
   * Build this territory parents tree
   * @param territoryId territory to build parent tree
   * @returns A tree of parents. Note that the same territory can appear multiple time in the tree
   */
  async getTerritoryParents(territoryId): Promise<TerritoryMongo> {
    let territory = await this.territoryModel
      .findOne<any>({ _id: new mongoose.Types.ObjectId(territoryId) }, { name: true, type: true, parents: true })
      .populate("type", "name");

    territory = territory.toObject();

    const new_parents: TerritoryMongo[] = [];
    for (const i in territory.parents) {
      //logInfo( territory.parents[i] );
      new_parents.push(await this.getTerritoryParents(territory.parents[i]));
    }
    //logInfo( new_parents );
    territory.parents = new_parents;

    return territory;
  }

  /**
   * Search city in database by keyword
   * @param keywordThe keyword to search for.
   * @returns A promise resolved with an array of City objects matching the specified search criteria.
   */
  async findCity(keyword?: string): Promise<TerritorySearchResultDto[]> {
    if (!keyword) {
      keyword = "";
    }

    const territoryTypes = await this.getTerritoryTypes();

    if (!process.env.COUNTRY_TOWN_TYPE) {
      throw Error("COUNTRY_TOWN_TYPE not defined in .env");
    }

    const town_type_id = territoryTypes[process.env.COUNTRY_TOWN_TYPE];

    if (!process.env.COUNTRY_TOWN_TYPE) {
      throw Error("COUNTRY_TOWN_TYPE not defined in .env");
    }
    if (!town_type_id) {
      throw Error("Cannot find territory type " + process.env.COUNTRY_TOWN_TYPE);
    }

    // Cleaning the keyword
    let clean_keyword = keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // see https://stackoverflow.com/questions/990904/remove-accents-diacritics-in-a-string-in-javascript
    clean_keyword = clean_keyword.toLowerCase().replace(/[\W_]+/g, " ");

    const searchRegex = new RegExp(`^${clean_keyword}`, "i");

    // For postal code (or shortname in general), there could be several postal codes separated by a comma, and we should match any of them
    const searchRegexPostalCode = new RegExp(`(^|,)${clean_keyword}`, "i");

    const query = {
      $and: [
        {
          type: town_type_id
        },
        {
          $or: [
            {
              cleanname: { $regex: searchRegex }
            },
            {
              shortname: { $regex: searchRegexPostalCode }
            }
          ]
        }
      ]
    };

    const result = await this.territoryModel
      .aggregate([
        {
          $match: query
        },
        {
          $project: { _id: 1, name: 1, shortname: 1, officialCode: 1 }
        },
        {
          $group: {
            _id: "$officialCode",
            count: { $sum: 1 },
            firstDoc: { $first: "$$ROOT" }
          }
        },
        {
          $replaceRoot: { newRoot: "$firstDoc" }
        }
      ])
      .sort({ name: 1 })
      .limit(10);

    return result;
  }

  /**
   * Return a random polling station (used for tests only)
   * @param
   * @returns A random polling station ID
   */
  async getRandomPollingStation() {
    const types = await this.getTerritoryTypes();

    const pollingStationTypeId = types["Polling Station"];

    const result = await this.territoryModel.aggregate([
      {
        $match: {
          type: pollingStationTypeId,
          officialCode: /^(?!Z).*/,
          parents: { $exists: true, $not: { $size: 0 } }
        }
      },
      { $sample: { size: 1 } }
    ]);

    return result[0]._id;
  }

  /**
   * Return a random city (used for tests only)
   * @param
   * @returns A random city ID
   */
  async getRandomCity() {
    const types = await this.getTerritoryTypes();

    if (!process.env.COUNTRY_TOWN_TYPE) {
      throw Error("COUNTRY_TOWN_TYPE not defined in .env");
    }

    const city_type_id = types[process.env.COUNTRY_TOWN_TYPE];

    const result = await this.territoryModel.aggregate([
      {
        $match: {
          type: city_type_id,
          parents: { $exists: true, $not: { $size: 0 } }
        }
      },
      { $sample: { size: 1 } }
    ]);

    return result[0]._id;
  }

  /**
   * Build "routes to parent territory" (Territory "routeTo" field), for all Polling Stations, from polling stations to the given type
   * @param {string} type - The territory type.
   * @returns true
   */
  async buildRoutes(target_territory_type_name: string) {
    logInfo("Building routes for " + target_territory_type_name);

    const types = await this.getTerritoryTypes();

    const pollingStationTypeId = types["Polling Station"];
    const targetTypeId = types[target_territory_type_name];

    if (!pollingStationTypeId || !target_territory_type_name) {
      throw Error("build_routes: Non existent type id!");
    }

    // Clean existing routes for all polling stations
    // TODO

    // Find all territories with the given type (only votable ones)
    const targets = await this.getTerritoriesFromType(targetTypeId, {
      bOnlyVotable: true,
      withoutRouteTo: targetTypeId
    });

    logInfo("We found " + targets.length + " targets");

    for (const i in targets) {
      logInfo("Processing target #" + (i + 1) + " : " + targets[i].name);

      const pollingStationsProcessed = await this.buildRoutesSubtree(
        targets[i],
        [targets[i]],
        pollingStationTypeId,
        targetTypeId
      );
      logInfo(pollingStationsProcessed + " stations processed");
    }

    logInfo("END updating routes");
  }

  /**
   * Build routes for a given territory (from all polling stations in this territory)
   */

  private async buildRoutesForTerritory(territory: Territory) {
    logInfo("Building routes for " + territory.name);

    const types = await this.getTerritoryTypes();

    const pollingStationTypeId = types["Polling Station"];
    const targetTypeId = territory.type._id.toString();

    if (!pollingStationTypeId || !targetTypeId) {
      throw Error("build_routes: Non existent type id!");
    }

    const pollingStationsProcessed = await this.buildRoutesSubtree(
      territory,
      [territory],
      pollingStationTypeId,
      targetTypeId
    );
    logInfo(pollingStationsProcessed + " stations processed");

    logInfo("END building routes for territory " + territory.name);
  }

  /**
   * Build "routes to parent territory" (Territory "routeTo" field), for all Polling Stations, for the subtree of territory that:
   * - start from the "territory" in parameter
   * - follow the "main subdivision" tree (see Territory type)
   *
   * @param territory - The territory at the root of the subtree
   * @param routeToTarget - the route going from current territory to the target
   * @param pollingStationTypeId
   * @param targetTypeId
   * @returns number of polling stations processed
   */
  private async buildRoutesSubtree(
    territory: Territory,
    routeToTarget: Territory[],
    pollingStationTypeId: string,
    targetTypeId: string
  ) {
    logDebug("exploring " + territory.name + " with type " + territory.type.name);
    //logDebug("routeToTarget = ", routeToTarget);

    const pollingStationsFound: string[] = [];
    let pollingStationsProcessed = 0;

    if (pollingStationTypeId == territory.type._id.toString()) {
      // Not supposed to happen
      throw new Error("buildRoutesSubtree: called on a polling station!");
    } else {
      // Explore subdivisions to find polling stations
      const subdivisionsToExplore: string[] = [];
      territory.subdivisions?.forEach((subdivision) => {
        if (subdivision.mainSubdivision) {
          subdivisionsToExplore.push(subdivision.subdivisionId._id);
        }
      });

      //logInfo("... we found "+subdivisionsToExplore.length+" main subdivision to explore ...");
      // Find details about "subdivisions" territories (child of current territory), with their types
      const subdivisions = await this.getTerritories(subdivisionsToExplore);

      for (const i in subdivisions) {
        if (pollingStationTypeId == subdivisions[i].type._id.toString()) {
          // This is a polling station!
          pollingStationsFound.push(subdivisions[i]._id);
        } else {
          // Not a polling station: continue exploration through this node
          pollingStationsProcessed += await this.buildRoutesSubtree(
            subdivisions[i],
            [subdivisions[i], ...routeToTarget],
            pollingStationTypeId,
            targetTypeId
          );
        }
      }
    }

    if (pollingStationsFound.length > 0) {
      //logInfo("We found "+polling_stations_found.length+" polling station! Let's update their routes");
      pollingStationsProcessed += pollingStationsFound.length;

      // Update their routes
      const field_name = "routeTo." + targetTypeId;
      await this.territoryModel.updateMany(
        {
          _id: { $in: pollingStationsFound }
        },
        {
          $set: {
            [field_name]: routeToTarget
          }
        }
      );
    }

    return pollingStationsProcessed;
  }

  /**
   *  Get all territories that are parents of the given polling station
   *  including parents of parents, etc.
   *  Make sure each territory appears only once in the result.
   *  Result is under the form of a map "territory type ID => territory ID"
   *  Note: in the case of multiple territories of the same type, only one is returned (any one)
   * @param pollingStationId The polling station ID
   * @returns A map "territory type ID => territory ID"
   */
  getParentTerritoriesFrom(pollingStationId: string) {
    logDebug("Get parent territories from polling station " + pollingStationId);

    return this.territoryModel
      .aggregate([
        { $match: { _id: new mongoose.Types.ObjectId(pollingStationId) } },
        {
          $graphLookup: {
            from: "c_territory",
            startWith: "$parents",
            connectFromField: "parents",
            connectToField: "_id",
            as: "allParents",
            depthField: "depth"
          }
        },
        {
          $project: {
            allParents: 1
          }
        },
        { $unwind: "$allParents" },
        {
          $sort: { "allParents.depth": 1 } // Sort by depth to prioritize closer parents
        },
        {
          $group: {
            _id: "$allParents.type", // Group by territory type
            territoryId: { $first: "$allParents._id" } // Get the first territory ID for each type
          }
        }
      ])
      .then((results) => {
        const territoryMap = {};
        results.forEach((result) => {
          territoryMap[result._id] = result.territoryId;
        });
        return territoryMap;
      });
  }

  /**
   * Set Baztille organization on a territory
   * @param {string} territoryId - The territory ID.
   * @param {TerritoryOrganizationUpdateDto} organization - The organization to set on this territory.
   * @returns true
   */
  async setOrganization(territoryId: string, organization: TerritoryOrganizationUpdateDto) {
    logInfo("Setting organization on territory " + territoryId);

    if (organization.nextElectionCandidate) {
      // Replace current nextElectionCandidate by the one provided
      logInfo(" - setting next election candidate to " + organization.nextElectionCandidate);
      await this.territoryModel.updateOne(
        { _id: new mongoose.Types.ObjectId(territoryId) },
        {
          $set: {
            "organization.nextElectionCandidate": organization.nextElectionCandidate
          }
        }
      );
    }

    if (organization.roles && organization.roles.length > 0) {
      for (const i in organization.roles) {
        const roleChange = organization.roles[i];
        logInfo(" - " + roleChange.action + " role " + roleChange.role + " for user " + roleChange.userId);

        if (roleChange.action == "ADD") {
          // Add this role for this user (if not already present)
          await this.territoryModel.updateOne(
            {
              _id: new mongoose.Types.ObjectId(territoryId),
              "organization.roles": {
                $not: {
                  // make sure we don't add duplicates for this user+role
                  $elemMatch: {
                    userId: roleChange.userId,
                    role: roleChange.role,
                    until: { $exists: false } // only consider active roles
                  }
                }
              }
            },
            {
              $addToSet: {
                "organization.roles": {
                  userId: roleChange.userId,
                  role: roleChange.role,
                  since: new Date()
                }
              }
            }
          );
        } else if (roleChange.action == "REMOVE") {
          // Remove this role for this user: setting "until" date to current date
          await this.territoryModel.updateOne(
            { _id: new mongoose.Types.ObjectId(territoryId) },
            {
              $set: {
                "organization.roles.$[elem].until": new Date()
              }
            },
            {
              arrayFilters: [
                { "elem.userId": roleChange.userId, "elem.role": roleChange.role, "elem.until": { $exists: false } }
              ]
            }
          );
        }
      }
    }

    return true;
  }

  /**
   * Set a territory as votable
   * = we can take decisions for this territory
   * @param {string} territoryId - The territory ID.
   * @returns true
   */
  async setVotable(territoryId: string) {
    logInfo("Setting territory " + territoryId + " as votable");

    // Get territory infos
    const territory = await this.getTerritory(territoryId);

    // Check if territory exists
    if (!territory) {
      throw new Error(`Territory with ID ${territoryId} not found`);
    }

    // If territory is already votable, do nothing
    if (territory && territory.votableTerritory && territory.votableTerritory.votableDecisions) {
      logInfo(" - territory is already votable");
    } else {
      // Create (or reset) votable territory data

      const newVotableTerritory: VotableTerritoryMongo = {
        votableDecisions: true,
        currentFeaturedDecisionTrigger: 10,
        latestFeaturedDecisionTriggerHistory: new Map<number, number>(),
        latestFeaturedDecisionTrigger: 10,
        latestFeaturedDecisionDate: Date.now()
      };

      // Update the territory or send exception if not found
      const result = await this.territoryModel.updateOne(
        { _id: new mongoose.Types.ObjectId(territoryId) },
        { $set: { votableTerritory: newVotableTerritory } }
      );
      if (result.matchedCount === 0) {
        throw new Error(`TerritoryMongo with ID ${territoryId} not found`);
      }
    }

    // Build routes from polling stations to this territory
    await this.buildRoutesForTerritory(territory);

    // Make sure chatroomId is defined (or create it if not)
    if (!territory.votableTerritory?.chatroomId) {
      logInfo(" - creating chatroom for votable territory");

      const chatRoomId = await this.chatService.createTerritoryChatroom(territory.name);
      logInfo(" - chatroom created with ID " + chatRoomId);

      // Update territory with chatroomId
      await this.territoryModel.updateOne(
        { _id: new mongoose.Types.ObjectId(territoryId) },
        { $set: { "votableTerritory.chatroomId": chatRoomId } }
      );
    }

    return true;
  }

  /**
   * Send a message on the room corresponding to a territory
   * @param territoryId string territory ID
   * @param message string message to send
   * @param metadata optional metadata to send with the message
   * @returns true if everything went well
   */
  async sendMessageToTerritoryChatroom(
    territoryId: string,
    message: string,
    metadata?: BaztilleChatMessageMedata
  ): Promise<boolean> {
    // Find territory chatroom ID
    const territory = await this.territoryModel.findOne(
      { _id: new mongoose.Types.ObjectId(territoryId) },
      { votableTerritory: 1 }
    );

    if (!territory || !territory.votableTerritory || !territory.votableTerritory.chatroomId) {
      throw new Error(`Territory with ID ${territoryId} not found or has no chatroom`);
    }

    const chatroomId = territory.votableTerritory.chatroomId;

    // Send message to chatroom
    await this.chatService.sendAsAdmin(chatroomId, message, metadata);

    return true;
  }

  /**
   * Check if a territory is votable
   * @param {string} territoryId - The territory ID.
   * @returns true if votable, false otherwise
   */
  async isVotable(territoryId: string): Promise<boolean> {
    logDebug("Checking if territory " + territoryId + " is votable");

    const territory = await this.territoryModel.findOne(
      { _id: new mongoose.Types.ObjectId(territoryId) },
      { votableTerritory: 1 }
    );

    if (territory && territory.votableTerritory && territory.votableTerritory.votableDecisions) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Update user count for each territory, based on the provided data
   * @param userCountByTerritory list of { territory: string, count: number } to update
   */
  async updateUserCountByTerritory(userCountByTerritory: { territory: string; count: number }[]) {
    for (const { territory, count } of userCountByTerritory) {
      await this.territoryModel.updateOne(
        { _id: new mongoose.Types.ObjectId(territory) },
        { $set: { registeredUsersCount: count } }
      );
    }
  }

  /**
   * Reset the hotness threshold for a territory after a decision has been featured:
   * - add current hotness score to history
   * - set latestFeatured* fields
   * - set new threshold to its new initial value
   * If territory is not votable, throw an error
   * @param territoryId The ID of the territory to update.
   * @param lastTreshold The hotness threshold value that was just reached.
   * @returns new treshold value
   */
  async resetTerritoryHotnessScore(territoryId: string, lastTreshold: number): Promise<number> {
    const newTreshold = 2 * lastTreshold;
    const triggerHistoryPropertyName = "votableTerritory.latestFeaturedDecisionTriggerHistory." + new Date().getTime();

    const result = await this.territoryModel.updateOne(
      { _id: new mongoose.Types.ObjectId(territoryId), votableTerritory: { $exists: true } },
      {
        $set: {
          "votableTerritory.currentFeaturedDecisionTrigger": newTreshold,
          "votableTerritory.latestFeaturedDecisionTrigger": lastTreshold,
          "votableTerritory.latestFeaturedDecisionDate": new Date().getTime(),
          [triggerHistoryPropertyName]: lastTreshold
        }
      }
    );

    if (result.matchedCount === 0) {
      throw new Error(`Territory with ID ${territoryId} not found or is not votable`);
    }

    return newTreshold;
  }

  /**
   * Cron job: update territories featured decision trigger (for votable territories)
   * Note: featured decision trigger is the hotness score threshold to feature a decision.
   *       It decreases over time to make it easier to feature decisions as time passes.
   */
  async updateTerritoriesFeaturedDecisionTrigger() {
    cronlogInfo("Updating territories featured decision trigger...");

    const votableTerritories = await this.territoryModel.find(
      { votableTerritory: { $exists: true } },
      { votableTerritory: 1, name: 1 }
    );

    for (const territory of votableTerritories) {
      if (!territory.votableTerritory) {
        continue;
      }
      const currentTrigger = territory.votableTerritory.currentFeaturedDecisionTrigger;

      cronlogInfo(` - processing territory ${territory.name} with current trigger ${currentTrigger}`);

      const latestFeaturedDecisionDate = territory.votableTerritory.latestFeaturedDecisionDate;
      const latestFeaturedDecisionTrigger = territory.votableTerritory.latestFeaturedDecisionTrigger;

      if (latestFeaturedDecisionDate == null) {
        cronlogInfo(`   - no latest featured decision date, skipping...`);
        continue;
      }
      if (latestFeaturedDecisionTrigger == null) {
        cronlogInfo(`   - no latest featured decision trigger, skipping...`);
        continue;
      }

      const now = Date.now();
      const timeDiff = now - latestFeaturedDecisionDate;
      const daysPassed = timeDiff / (1000 * 60 * 60 * 24);
      const decayFactor = this.getHotnessDecayFactor(daysPassed);
      const newTrigger = Math.round(latestFeaturedDecisionTrigger * decayFactor);

      // Plot getHotnessDecayFactor for debugging
      //for (let d = 0; d <= 30; d += 1) {
      //  const decay = this.getHotnessDecayFactor(d);
      //  cronlogInfo(`${d}:${decay}`);
      //}

      cronlogInfo(
        `   - days passed since last featured decision: ${daysPassed}, decay factor: ${decayFactor}, previous trigger: ${latestFeaturedDecisionTrigger}, new trigger: ${newTrigger}`
      );

      // Update territory with new trigger
      await this.territoryModel.updateOne(
        { _id: territory._id },
        {
          $set: {
            "votableTerritory.currentFeaturedDecisionTrigger": newTrigger
          }
        }
      );
    }

    if (votableTerritories.length === 0) {
      cronlogInfo("   - no votable territory found, nothing to do.");
    } else {
      // Signal that we updated at least one territory (so decision module can check for decisions to feature)
      this.eventEmitter.emit(InternalEventsEnum.TERRITORY_FEATURED_DECITIONS_TRIGGER_UPDATE);
    }
  }

  /**
   * Process decay factor for hotness score threshold, based on days passed since last featured decision
   * @param daysPassed (not necessarily integer)
   */
  getHotnessDecayFactor(daysPassed: number): number {
    // During the 4 first days, decay from 2.0 to 1.6, linearly
    if (daysPassed <= 4) {
      return 2.0 - (daysPassed * 0.4) / 4;
    }

    // Between day 4 and day 10, decay from 1.6 to 0.4, linearly
    // (note: it means that on day 7, decay is 1.0 => we want an average of 1 featured decision per week)
    if (daysPassed <= 10) {
      return 1.6 - ((daysPassed - 4) * 1.2) / (10 - 4);
    }

    // After day 10, decay go from 0.4 to 0.1, exponentially, with a half-life of 3 days
    const halfLife = 3;
    const decayAfter10Days = 0.1 + 0.3 * Math.pow(0.5, (daysPassed - 10) / halfLife);
    return decayAfter10Days;
  }

  /*************************
   * UTILITIES
   */

  /*
   ** Get all territory types from database
   ** Returns a map: territory type name => territory type ID
   */
  async getTerritoryTypes(): Promise<{ [key: string]: string }> {
    const territoryTypes = await this.territoryTypeModel.find({}, { _id: true, name: true });

    // Build types => type_id
    const territoryTypeToTypeId = {};
    for (const i in territoryTypes) {
      territoryTypeToTypeId[territoryTypes[i].name] = territoryTypes[i]._id;
    }

    return territoryTypeToTypeId;
  }
}
