import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { OnEvent } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { ChatService } from "src/chat/chat.service";
import { SendGridTemplateList } from "src/common/email/send-mail.dto";
import { InternalEventsEnum } from "src/common/enum/internal-events.enum";
import { GlobalKey } from "src/common/globals/globals.enum";
import { GlobalsService } from "src/common/globals/globals.service";
import { TrackEventType } from "src/event/event-types";
import { EventService } from "src/event/event.service";
import { getCurrentDate } from "src/utils/date-time";
import { logDebug, logInfo, logWarning } from "src/utils/logger";
import { getLevelFromPoints } from "../level/levels";
import { UserPrivateViewDto } from "../user/dto/user-private-view.dto";
import { User } from "../user/types/user.type";
import { UserMissionCompletedMongo, UserMongo } from "../user/user.schema";
import { UserService } from "../user/user.service";
import { CollectiveMissionDto, MissionProgressionDto, MissionWithUserInfoDto, MyMissionsListDto } from "./mission.dto";
import { MissionDocument, MissionMongo } from "./mission.schema";
import { MISSION_TYPES, MissionsByTypes, MissionType } from "./types/mission-type";

const email_templates: SendGridTemplateList = JSON.parse(process.env.SENDGRID_TEMPLATES ?? "{}");

@Injectable()
export class MissionService {
  constructor(
    @InjectModel(UserMongo.name) private readonly userModel: Model<UserMongo>,
    @InjectModel(MissionMongo.name) private readonly missionModel: Model<MissionMongo>,
    private globalService: GlobalsService,
    private readonly userService: UserService,
    private readonly chatService: ChatService,
    private readonly eventService: EventService
  ) {}

  private missions_by_types: MissionsByTypes | null = null;

  async getMissionDataTmp(currentUser: User): Promise<any> {
    return {
      max_voters_five_last_decisions: await this.globalService.getGlobal<number>(
        GlobalKey.MAX_VOTERS_FIVE_LAST_DECISIONS
      )
    };
  }

  /**
   * Get current collective mission (country wide) for this server
   * @param currentUser
   * @returns collective mission
   */
  async getCollectiveMission(): Promise<CollectiveMissionDto> {
    const citizens_number = await this.globalService.getGlobal<number>(GlobalKey.CITIZENS_NUMBER);

    if (!citizens_number || citizens_number < 1000) {
      return {
        id: "mission_collective_1000",
        current: citizens_number || 0,
        target: 1000
      };
    } else if (citizens_number < 10000) {
      return {
        id: "mission_collective_10000",
        current: citizens_number,
        target: 10000
      };
    } else if (citizens_number < 100000) {
      return {
        id: "mission_collective_100000",
        current: citizens_number,
        target: 100000
      };
    } else {
      throw new BadRequestException("Collective missions are not available anymore as we have reached 100k citizens");
    }
  }

  /*  * Create missions on database
   * @returns true
   * @description This function is used to create missions in database. It is only used by admins
   */
  async createMissions() {
    logInfo("Create missions on database");

    await this.createMission({ mission_type: MissionType.REGISTER, points: 1 });
    await this.createMission({ mission_type: MissionType.FIRST_VOTE, points: 7, displayPriority: 1000 });

    // Join social networks
    for (let i = 1; i <= 5; i++) {
      await this.createMission({
        mission_type: MissionType.JOIN_OUR_NETWORKS,
        points: 3,
        typeArg: i,
        prerequisite: ["discover_first-vote"],
        displayPriority: i == 0 ? 400 : 100
      });
    }

    // Avatar
    await this.createMission({
      mission_type: MissionType.AVATAR,
      points: 1,
      prerequisite: ["discover_first-vote"],
      displayPriority: 200
    });
    // Enable notifications
    await this.createMission({ mission_type: MissionType.ENABLE_NOTIFICATIONS, points: 3, displayPriority: 500 });

    // Vote next decision
    await this.createMission({
      mission_type: MissionType.VOTE_NEXT_SUBJECT,
      points: 2,
      minUserLevel: 1,
      displayPriority: 300
    });
    await this.createMission({
      mission_type: MissionType.VOTE_NEXT_PROPOSITIONS,
      points: 2,
      minUserLevel: 1,
      displayPriority: 300
    });

    // Store review
    await this.createMission({
      mission_type: MissionType.STORE_REVIEW,
      points: 3,
      minUserLevel: 2,
      displayPriority: 100
    });
    // Recruit
    await this.createMission({ mission_type: MissionType.NBR_RECRUIT, points: 10, typeArg: 1, displayPriority: 950 }); // Note: 5 more points for first recruit
    await this.createMission({ mission_type: MissionType.NBR_RECRUIT, points: 5, typeArg: 2, displayPriority: 950 });
    await this.createMission({
      mission_type: MissionType.NBR_RECRUIT,
      points: 5,
      typeArg: 3,
      displayPriority: 950,
      prerequisite: ["referral_active-recruit_1"]
    });
    await this.createMission({
      mission_type: MissionType.NBR_RECRUIT,
      points: 10,
      typeArg: 5,
      displayPriority: 950,
      prerequisite: ["referral_active-recruit_2"]
    });
    for (let i = 10; i <= 200; i += 5) {
      // Prerequisite: active recruit (see below) for 50% of the total number (ie: ~50% of the existing recruits must be active to unlock the next recruit mission)
      await this.createMission({
        mission_type: MissionType.NBR_RECRUIT,
        points: 10,
        typeArg: i,
        displayPriority: 950,
        prerequisite: ["referral_active-recruit_" + Math.floor(i / 2 / 5) * 5]
      });
    }

    // Active recruit
    await this.createMission({
      mission_type: MissionType.ACTIVE_RECRUIT,
      points: 5,
      typeArg: 1,
      prerequisite: ["referral_nbr-recruit_1"],
      displayPriority: 900
    });
    await this.createMission({
      mission_type: MissionType.ACTIVE_RECRUIT,
      points: 5,
      typeArg: 2,
      prerequisite: ["referral_nbr-recruit_2"],
      displayPriority: 900
    });
    await this.createMission({
      mission_type: MissionType.ACTIVE_RECRUIT,
      points: 5,
      typeArg: 3,
      prerequisite: ["referral_nbr-recruit_3"],
      displayPriority: 900
    });
    await this.createMission({
      mission_type: MissionType.ACTIVE_RECRUIT,
      points: 10,
      typeArg: 5,
      prerequisite: ["referral_nbr-recruit_5"],
      displayPriority: 900
    });
    for (let i = 10; i <= 200; i += 5) {
      // Prerequisite: having the equivalent "Recruit" mission
      await this.createMission({
        mission_type: MissionType.ACTIVE_RECRUIT,
        points: 25,
        typeArg: i,
        prerequisite: ["referral_nbr-recruit_" + i],
        displayPriority: 900
      });
    }

    // Level 3 recruit
    // (= recruit reach level 3)
    await this.createMission({
      mission_type: MissionType.SUPER_RECRUIT,
      points: 10,
      typeArg: 1,
      prerequisite: ["referral_active-recruit_1"],
      minUserLevel: 3,
      displayPriority: 700
    });
    await this.createMission({ mission_type: MissionType.SUPER_RECRUIT, points: 10, typeArg: 2, displayPriority: 700 });
    await this.createMission({ mission_type: MissionType.SUPER_RECRUIT, points: 10, typeArg: 3, displayPriority: 700 });
    await this.createMission({ mission_type: MissionType.SUPER_RECRUIT, points: 20, typeArg: 5, displayPriority: 700 });
    for (let i = 10; i <= 200; i += 5) {
      await this.createMission({
        mission_type: MissionType.SUPER_RECRUIT,
        points: 50,
        typeArg: i,
        displayPriority: 700
      });
    }

    // Vote streak
    // (note: consecutive votes)
    // Note: DEPRECATED mission at now (hidden)
    /*await this.createMission({
      mission_type: MissionType.VOTE_STREAK,
      points: 2,
      typeArg: 2,
      prerequisite: ["discover_first-vote"],
      displayPriority: 800
    });
    await this.createMission({ mission_type: MissionType.VOTE_STREAK, points: 1, typeArg: 3, displayPriority: 800 });
    await this.createMission({ mission_type: MissionType.VOTE_STREAK, points: 2, typeArg: 5, displayPriority: 800 });
    for (let i = 10; i <= 50; i += 5) {
      await this.createMission({ mission_type: MissionType.VOTE_STREAK, points: 5, typeArg: i, displayPriority: 800 });
    }
    for (let i = 60; i <= 400; i += 10) {
      await this.createMission({ mission_type: MissionType.VOTE_STREAK, points: 10, typeArg: i, displayPriority: 800 });
    }*/
  }

  private async createMission(mission: {
    mission_type: MissionType;
    points: number;
    typeArg?: number;
    prerequisite?: string[];
    minUserLevel?: number;
    hidden?: boolean;
    displayPriority?: number;
  }) {
    const mission_category_for_slug = MISSION_TYPES[mission.mission_type].category.replace(/_/g, "-");
    const mission_type_for_slug = mission.mission_type.replace(/_/g, "-");

    // Build slug using snake_case input keys (typeArg) but store camelCase in DB
    let mission_slug = mission.typeArg
      ? `${mission_category_for_slug}_${mission_type_for_slug}_${mission.typeArg}`
      : `${mission_category_for_slug}_${mission_type_for_slug}`;
    mission_slug = mission_slug.toLowerCase();

    try {
      await new this.missionModel({
        category: MISSION_TYPES[mission.mission_type].category,
        type: mission.mission_type,
        slug: mission_slug,
        points: mission.points,
        typeArg: mission.typeArg,
        prerequisite: mission.prerequisite ? mission.prerequisite : [],
        minUserLevel: mission.minUserLevel ? mission.minUserLevel : 0,
        hidden: mission.hidden ? mission.hidden : false,
        displayPriority: mission.displayPriority ? mission.displayPriority : 0
      }).save();

      logInfo("Create mission " + mission_slug + " on database");
    } catch (error) {
      logInfo("Error while creating mission " + mission_slug + " on database: " + error?.message);
      logInfo("Mission " + mission_slug + " already exists");
      // Ignore error if mission already exists
    }
  }

  // Build the progression method name from an UPPER_SNAKE_CASE mission type
  // Example: ENABLE_NOTIFICATIONS -> getMissionProgressionEnableNotifications
  private getMissionProgressionMethodName(type: string): string {
    if (!type) return "getMissionProgressionUnknown";
    const parts = type.split("_").filter((p) => p.length > 0);
    const suffix = parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join("");
    return "getMissionProgression" + suffix;
  }

  /*   Get missions from database, for a specific user
   * Note: return only missions that the user can unlock (depending on his level, previous missions, etc.)
   * @returns missions
   */
  async getMyMissions(user: User): Promise<MyMissionsListDto> {
    logInfo("Get missions for user " + user._id);

    // Get all missions from database or cache
    const missions_by_types = await this.getMissionsInfos();
    //logInfo('missions', missions);

    // Now, process all missions types, one by one, and check in which status they are:
    // 'collected': missions already completed and collected by user
    // 'collectable': missions completed by user but not collected yet (user can collect points)
    // 'available': missions available for user (but not completed yet)
    // 'locked': missions not available for user (should be hidden for this user)

    const missions: MyMissionsListDto = {
      collected: [],
      collectable: [],
      available: []
      //locked: [] // Note: locked missions are not returned to user
    };

    /*if( user.role != Role.ADMIN && process.env.ENVIRONMENT != 'dev' ) {
      // Note: temporary return empty missions as we are not ready yet to deliver missions features to users
      // Note: this also disable checkMissionsForUser as it is using this function
      return missions;
    }*/

    for (const mission_type in missions_by_types) {
      const mission_type_data = missions_by_types[mission_type];

      //logDebug('Mission type: '+mission_type);

      // Get the first mission of this type not completed by user
      let first_mission: MissionDocument | null = null;
      for (const mission_index in mission_type_data.missions) {
        const mission = mission_type_data.missions[mission_index];
        if (!user.missionsCompleted || !user.missionsCompleted.get(mission.slug)) {
          // This mission has not been completed yet by user
          first_mission = mission;
          break;
        } else {
          // This mission has been completed by user
          const mission_to_add = JSON.parse(JSON.stringify(mission)); // Clone the mission object
          mission_to_add.completionDate = user.missionsCompleted.get(mission.slug)?.completionDate; // Add completion date

          if (user.missionsCompleted.get(mission.slug)?.collected) {
            // This mission has been collected by user
            // Add this mission to the list of completed missions
            mission_to_add.collectionDate = user.missionsCompleted.get(mission.slug)?.collectionDate; // Add collection date

            mission_to_add.progression = {
              completed: true,
              collected: true
            };
            missions.collected.push(mission_to_add);
          } else {
            // This mission has not been collected by user
            // Add this mission to the list of collectable missions
            mission_to_add.progression = {
              completed: true,
              collected: false
            };
            missions.collectable.push(mission_to_add);
          }
        }
      }

      if (first_mission) {
        // This mission is not completed by user

        // Check if this mission is available for user (= he can complete it)
        let is_available = true; // by default, we assume the mission is available

        // Check minimum user level
        if (first_mission.minUserLevel && user.level < first_mission.minUserLevel) {
          is_available = false; // user is not at the required level for this mission
        }

        // Check prerequisites
        if (first_mission.prerequisite && first_mission.prerequisite.length > 0) {
          for (let i = 0; i < first_mission.prerequisite.length; i++) {
            const prerequisite = first_mission.prerequisite[i];
            if (!user.missionsCompleted || !user.missionsCompleted.get(prerequisite)) {
              is_available = false; // user has not completed the prerequisite mission
            }
          }
        }

        if (is_available) {
          // This mission is available for user
          // Compute progression using dynamically resolved camelCase method name
          const progressionMethodName = this.getMissionProgressionMethodName(first_mission.type);
          const progressionFn: (user_data: User, missionTypeArg: number) => MissionProgressionDto = (this as any)[
            progressionMethodName
          ];
          if (typeof progressionFn !== "function") {
            logWarning(
              "Mission type " + first_mission.type + " not implemented (expected method " + progressionMethodName + ")"
            );
            // Skip this mission if no implementation exists
          } else {
            const mission_to_add: MissionWithUserInfoDto = JSON.parse(JSON.stringify(first_mission)); // Clone the mission object
            mission_to_add.progression = progressionFn.call(this, user, first_mission.typeArg);

            if (mission_to_add.progression.completed) {
              mission_to_add.progression.collected = false; // Not collected yet
              missions.collectable.push(mission_to_add);
            } else {
              missions.available.push(mission_to_add);
            }
          }
        }
      }
    }

    // Sort collected mission by completionDate
    missions.collected.sort((a, b) => {
      // Sort by completion date (most recent first)
      if ((a.completionDate ?? 0) > (b.completionDate ?? 0)) {
        return -1;
      } else if ((a.completionDate ?? 0) < (b.completionDate ?? 0)) {
        return 1;
      }
      return 0;
    });

    // Sort collectable missions by number of points (higher number first)
    missions.collectable.sort((a, b) => {
      // Sort by points (higher number first)
      if (a.points > b.points) {
        return -1;
      } else if (a.points < b.points) {
        return 1;
      }
      return 0;
    });

    // Finally, sort available missions by display priority
    missions.available.sort((a, b) => {
      // Sort by display priority (higher number first)
      if (a.displayPriority > b.displayPriority) {
        return -1;
      } else if (a.displayPriority < b.displayPriority) {
        return 1;
      }
      return 0;
    });

    return missions;
  }

  /*  Get specific mission info from database, for a specific user
   * Note: return one missions if it exists
   * @returns mission
   */
  public async getMissionInfo(
    user: User,
    mission: { type: string; typeArg?: number }
  ): Promise<{ mission: MissionDocument; completed: UserMissionCompletedMongo | null }> {
    logInfo("Get mission " + mission.type + " " + mission.typeArg + " for user " + user._id);
    logDebug("User: ", user);

    // Get all missions from database or cache
    const missions_by_types = await this.getMissionsInfos();

    if (missions_by_types[mission.type]) {
      // This mission exists
      const missionTypeInfos = missions_by_types[mission.type];
      logDebug("Mission from this type: ", missionTypeInfos);

      const missionInfos = mission.typeArg ? missionTypeInfos.missions[mission.typeArg] : missionTypeInfos.missions[0];

      if (!missionInfos) {
        // This mission does not exist
        throw new NotFoundException("Mission not found: " + mission.type + " " + mission.typeArg);
      }

      logDebug("Mission infos: ", missionInfos);

      // Check if user has completed/collected this mission
      const userMissionsCompleted = user.missionsCompleted ? user.missionsCompleted.get(missionInfos.slug) : null;

      logDebug("User missions completed: ", userMissionsCompleted);

      return {
        mission: missionInfos,
        completed: userMissionsCompleted ? userMissionsCompleted : null
      };
    } else {
      // This mission does not exist
      logInfo(missions_by_types);
      throw new NotFoundException("Mission not found: " + mission.type);
    }
  }

  async checkAllUsersMissions() {
    logInfo("Check all users missions to see if there are collectable missions that are not in DB yet");

    // Get all users from database
    const users = await this.userModel.find({ removedAccountDate: { $exists: false } }, { _id: true }).exec();

    for (let i = 0; i < users.length; i++) {
      const user = users[i];

      await this.checkMissionsForUser(user._id);
    }
  }

  @OnEvent(InternalEventsEnum.USER_CHECK_MISSIONS_FOR_USER, { async: true })
  async handleEventCheckMissionsForUser(payload: { userId: string }) {
    logInfo("Event received: checkMissionsForUser for user " + payload.userId);
    await this.checkMissionsForUser(payload.userId);
  }

  async checkMissionsForUser(userId: string) {
    logInfo(
      "Check all missions for user " + userId + " to see if there are collectable missions that are not in DB yet"
    );

    let bAtLeastOneMissionAdded = false;

    // Get user from database
    const user = await this.userService.getUserCompleteById(userId);
    if (!user) {
      throw new NotFoundException("User not found: " + userId);
    }

    const result = await this.getMyMissions(user);

    //logDebug("User missions: ", result);
    logInfo("Collectable missions: ", result.collectable);

    for (let i = 0; i < result.collectable.length; i++) {
      const mission = result.collectable[i];

      if (user.missionsCompleted && user.missionsCompleted.get(mission.slug)) {
        // This mission is already in DB
      } else {
        // This mission should be in DB => let's add it

        logInfo("CHECKED mission " + mission.slug + " for user " + user._id + ": COLLECTABLE => add it to DB");

        // Add this mission to user missionsCompleted field
        await this.userModel
          .updateOne(
            { _id: user._id },
            {
              $set: {
                [`missionsCompleted.${mission.slug}`]: {
                  slug: mission.slug,
                  collected: false,
                  completionDate: getCurrentDate()
                }
              }
            }
          )
          .exec();

        bAtLeastOneMissionAdded = true;

        // Notify user that he has a new collectable mission
        logInfo("Notify user " + user._id + " that he has a new collectable mission: " + mission.slug);

        if (mission.slug == "discover_register") {
          // By exception, we do not send a notification for the first mission (otherwise it is sent a the wrong time)
          logInfo("Do not send notification for mission discover_register");
        } else {
          this.chatService.sendNotificationToUser(user._id, "MISSIONS.NOTIFICATION_MISSION_COMPLETED", {
            translate: true, // This message must be translated on app side
            translate_args: {
              // Arguments for translated string
              mission: mission // Note: mission argument translation is managed specifically on app side
            },
            trigger: "new_mission_completed", // This trigger the display of the "yellow dot" on the profile tab on app side
            gotopageUrl: "/profile/home",
            gotopageLabel: "MESSAGING.GOTOPAGE_LABEL_COLLECT_POINTS"
          });
        }

        // Track
        await this.eventService.trackEvent(TrackEventType.MISSION_COMPLETED, {
          slug: mission.slug,
          forceUserId: user._id // Force this event to be linked to the user as user who completed the mission is not necessarly the one that initiate the request
        });
      }
    }

    return bAtLeastOneMissionAdded;
  }

  /*   Get missions from database (or cache)
   * @returns missions
   */
  private async getMissionsInfos(): Promise<MissionsByTypes> {
    if (this.missions_by_types) {
      // If missions are already loaded, return them
      return this.missions_by_types;
    }

    logInfo("Get missions from database");

    // Get all missions from database or cache, sorted by type then typeArg
    const missions: MissionDocument[] = await this.missionModel.find({}).sort({ type: 1, typeArg: 1 }).exec();

    // We group missions by types so they are easier to process
    const missions_by_types: MissionsByTypes = {};

    for (let i = 0; i < missions.length; i++) {
      const mission = missions[i];
      if (!missions_by_types[mission.type]) {
        missions_by_types[mission.type] = {
          type: mission.type,
          category: mission.category, // Note: category is the same for all missions of the same type
          missions: {}
        };
      }

      const mission_index = mission.typeArg ? mission.typeArg : 0;

      missions_by_types[mission.type].missions[mission_index] = mission;
    }

    this.missions_by_types = missions_by_types;

    return missions_by_types;
  }

  public async reclaimMission(mission: { type: string; typeArg?: number }, user: User): Promise<UserPrivateViewDto> {
    logInfo("Reclaim mission " + mission.type + " for user " + user._id);

    // Note: this may be possible that the user have completed the mission, but that for some reason the "checkMissionsForUser"
    // has not been called yet, so the mission is not in the user.missionsCompleted field
    // This should not happen, but if if does, we prefer to call "checkMissionsForUser" before anything else
    if (await this.checkMissionsForUser(user._id)) {
      // We indeed found one !
      // We should reload user data to get the updated missionsCompleted field
      logInfo(
        "User " + user._id + " has at least one collectable mission that was not in DB yet, so we reload user data"
      );
      user = await this.userService.getUserCompleteById(user._id);
      logInfo(user.missionsCompleted);
    }

    // Check if user has already completed this mission
    const missionInfos = await this.getMissionInfo(user, mission);

    logInfo("Mission infos: ", missionInfos);

    if (!missionInfos.completed) {
      throw new BadRequestException("Mission not completed: " + mission.type);
    }
    if (missionInfos.completed.collected) {
      throw new BadRequestException("Mission already collected: " + mission.type);
    }

    // Check if there is a level up
    const currentUserLevel = getLevelFromPoints(user.points);
    const newUserLevel = getLevelFromPoints(user.points + missionInfos.mission.points);
    if (currentUserLevel !== newUserLevel) {
      // User has leveled up
      logInfo("User " + user._id + " has leveled up from level " + currentUserLevel + " to level " + newUserLevel);

      // Trigger whatever is needed on level up
      await this.eventService.trackEvent(TrackEventType.LEVEL_UP, { newLevel: newUserLevel });

      // We need to change this user's level on user's mentor recruits list if needed
      if (user.mentor) {
        logInfo(
          "User " +
            user._id +
            " has leveled up, so we update this recruits level on its mentor recruits data " +
            user.mentor
        );
        await this.userModel
          .updateOne({ _id: user.mentor }, { $set: { [`recruits.${user._id}.level`]: newUserLevel } })
          .exec();

        if (currentUserLevel < 3 && newUserLevel >= 3) {
          // This user has reached level 3 => this is a "super recruit" for its mentor
          logInfo("User " + user._id + " has reached level 3, so it is a super recruit for its mentor " + user.mentor);

          // Notify mentor that he has a new super recruit
          this.checkMissionsForUser(user.mentor);
        }
      }
    }

    // Let's reclaim the mission and add points to user
    await this.userModel
      .updateOne(
        { _id: user._id },
        {
          $set: {
            [`missionsCompleted.${missionInfos.mission.slug}`]: {
              slug: missionInfos.mission.slug,
              collected: true,
              completionDate: missionInfos.completed.completionDate, // Keep the original completion date
              collectionDate: getCurrentDate()
            },
            level: newUserLevel
          },
          $inc: { points: missionInfos.mission.points }
        }
      )
      .exec();
    logInfo(
      "Mission " +
        mission.type +
        " collected for user " +
        user._id +
        " and " +
        missionInfos.mission.points +
        " points added"
    );

    // Track
    await this.eventService.trackEvent(TrackEventType.MISSION_COLLECTED, {
      slug: missionInfos.mission.slug,
      points: missionInfos.mission.points
    });

    // Return the updated user
    return await this.userService.getUserPrivateById(user._id);
  }

  /********************************* MISSIONS TYPES PROGRESSION COMPUTATION ******************************/

  /*
   *  Methods below are used to compute the progression of missions depending on:
   *  - user data
   *  - mission type + typeArg
   */

  private getMissionProgressionRegister(user_data: User, missionTypeArg: number): MissionProgressionDto {
    // User has registered

    return {
      prerequisiteStepsNbr: 0,
      currentStepsNbr: 1,
      totalStepsNbr: 1,
      completed: true // This mission is always completed
    };
  }

  private getMissionProgressionEnableNotifications(user_data: User, missionTypeArg: number): MissionProgressionDto {
    // User has enabled notifications

    if (user_data.devices) {
      user_data.devices.forEach((device) => {
        if (device.notifToken) {
          // User has at least one device with notifications enabled
          return {
            prerequisite_steps_nbr: 0,
            current_steps_nbr: 1,
            total_steps_nbr: 1,
            completed: true
          };
        }
      });
    }

    // If we reach this point, user has no device with notifications enabled
    return {
      prerequisiteStepsNbr: 0,
      currentStepsNbr: 0,
      totalStepsNbr: 1,
      completed: false
    };
  }

  private getMissionProgressionFirstVote(user_data: User, missionTypeArg: number): MissionProgressionDto {
    // User has voted for the first time

    const prerequisiteStepsNbr = 0;
    const currentStepsNbr = user_data?.activity?.votesNbr ? user_data.activity.votesNbr : 0; // Note: votesNbr is the number of votes user has casted
    const totalStepsNbr = 1;

    return {
      prerequisiteStepsNbr: prerequisiteStepsNbr,
      currentStepsNbr: currentStepsNbr,
      totalStepsNbr: 1,
      completed: currentStepsNbr >= totalStepsNbr
    };
  }

  private getMissionProgressionJoinOurNetworks(user_data: User, missionTypeArg: number): MissionProgressionDto {
    // User has joined a social network

    const prerequisiteStepsNbr = missionTypeArg - 1;
    const currentStepsNbr = user_data?.socialNetworks ? user_data.socialNetworks.size : 0;
    const totalStepsNbr = missionTypeArg;

    return {
      prerequisiteStepsNbr: prerequisiteStepsNbr,
      currentStepsNbr: currentStepsNbr,
      totalStepsNbr: totalStepsNbr,
      completed: currentStepsNbr >= totalStepsNbr
    };
  }

  private getMissionProgressionAvatar(user_data: User, missionTypeArg: number): MissionProgressionDto {
    // User has uploaded an avatar

    const prerequisiteStepsNbr = 0;
    const currentStepsNbr = user_data?.avatar ? 1 : 0; // Note: user_data.avatar is the avatar ID
    const totalStepsNbr = 1;

    return {
      prerequisiteStepsNbr: prerequisiteStepsNbr,
      currentStepsNbr: currentStepsNbr,
      totalStepsNbr: totalStepsNbr,
      completed: currentStepsNbr >= totalStepsNbr
    };
  }

  private getMissionProgressionVoteNextSubject(user_data: User, missionTypeArg: number): MissionProgressionDto {
    // User has submitted a new subject

    const prerequisiteStepsNbr = 0;
    const currentStepsNbr = user_data?.activity?.votesNextSubject_nbr ? user_data.activity.votesNextSubject_nbr : 0; // Note: votesNextSubject_nbr is the number of votes user has casted for the next subject
    const totalStepsNbr = 1;

    return {
      prerequisiteStepsNbr: prerequisiteStepsNbr,
      currentStepsNbr: currentStepsNbr,
      totalStepsNbr: totalStepsNbr,
      completed: currentStepsNbr >= totalStepsNbr
    };
  }

  private getMissionProgressionVoteNextPropositions(user_data: User, missionTypeArg: number): MissionProgressionDto {
    // User has submitted a new proposition

    const prerequisiteStepsNbr = 0;
    const currentStepsNbr = user_data?.activity?.votesNextPropositions_nbr
      ? user_data.activity.votesNextPropositions_nbr
      : 0; // Note: votesNextPropositions_nbr is the number of new propositions submitted by the user
    const totalStepsNbr = 1;

    return {
      prerequisiteStepsNbr: prerequisiteStepsNbr,
      currentStepsNbr: currentStepsNbr,
      totalStepsNbr: totalStepsNbr,
      completed: currentStepsNbr >= totalStepsNbr
    };
  }

  private getMissionProgressionStoreReview(user_data: User, missionTypeArg: number): MissionProgressionDto {
    // User has written a store review
    const prerequisiteStepsNbr = 0;
    const currentStepsNbr = user_data?.appStoreReviews ? user_data.appStoreReviews.size : 0;
    const totalStepsNbr = 1;
    return {
      prerequisiteStepsNbr: prerequisiteStepsNbr,
      currentStepsNbr: currentStepsNbr,
      totalStepsNbr: totalStepsNbr,
      completed: currentStepsNbr >= totalStepsNbr
    };
  }

  private getMissionProgressionNbrRecruit(user_data: User, missionTypeArg: number): MissionProgressionDto {
    // User has recruited his first user

    const prerequisiteStepsNbr = 0;
    const currentStepsNbr = user_data?.recruits ? user_data?.recruits.size : 0;
    const totalStepsNbr = missionTypeArg;

    return {
      prerequisiteStepsNbr: prerequisiteStepsNbr,
      currentStepsNbr: currentStepsNbr,
      totalStepsNbr: totalStepsNbr,
      completed: currentStepsNbr >= totalStepsNbr
    };
  }

  private getMissionProgressionActiveRecruit(user_data: User, missionTypeArg: number): MissionProgressionDto {
    // User has recruited a number of users

    const prerequisiteStepsNbr = 0;

    // Count number of active recruits
    // (ie: recruits that have been active in the last 28 days)
    let currentStepsNbr = 0;
    if (user_data?.recruits) {
      user_data.recruits.forEach((recruit) => {
        const recruitLastVoteTime = recruit.lastVoteTime;
        if (recruitLastVoteTime && getCurrentDate().getTime() - recruitLastVoteTime < 28 * 24 * 60 * 60 * 1000) {
          // Recruit is active if he has been active in the last 28 days
          currentStepsNbr++;
        }
      });
    }

    const totalStepsNbr = missionTypeArg;

    return {
      prerequisiteStepsNbr: prerequisiteStepsNbr,
      currentStepsNbr: currentStepsNbr,
      totalStepsNbr: totalStepsNbr,
      completed: currentStepsNbr >= totalStepsNbr
    };
  }

  private getMissionProgressionSuperRecruit(user_data: User, missionTypeArg: number): MissionProgressionDto {
    // User has recruited a number of users with level >= 3

    const prerequisiteStepsNbr = 0;

    // Count number of recruits with level >= 3
    let currentStepsNbr = 0;

    if (user_data?.recruits) {
      user_data.recruits.forEach((recruit) => {
        const recruit_level = recruit.level;
        if (recruit_level && recruit_level >= 3) {
          currentStepsNbr++;
        }
      });
    }

    const totalStepsNbr = missionTypeArg;

    return {
      prerequisiteStepsNbr: prerequisiteStepsNbr,
      currentStepsNbr: currentStepsNbr,
      totalStepsNbr: totalStepsNbr,
      completed: currentStepsNbr >= totalStepsNbr
    };
  }

  /*
  private getMissionProgressionVoteStreak(user_data: User, missionTypeArg: number): MissionProgressionDto {
    // User has voted a number of times in a row

    const prerequisiteStepsNbr = 0;
    const currentStepsNbr = user_data?.activity?.votesStreak ? user_data.activity.votesStreak : 0; // Note: votesStreak is the number of consecutive votes user has casted
    const totalStepsNbr = missionTypeArg;

    return {
      prerequisiteStepsNbr: prerequisiteStepsNbr,
      currentStepsNbr: currentStepsNbr,
      totalStepsNbr: totalStepsNbr,
      completed: currentStepsNbr >= totalStepsNbr
    };
  }
    */
}
