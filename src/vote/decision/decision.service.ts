import { BadRequestException, Injectable } from "@nestjs/common";
import { EventEmitter2, OnEvent } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model, Types } from "mongoose";
import { AiService } from "src/ai/ai.service";
import { ChatService } from "src/chat/chat.service";
import { EmailService } from "src/common/email/email.service";
import { ALL_USERS } from "src/common/email/send-mail.dto";
import { InternalEventsEnum } from "src/common/enum/internal-events.enum";
import { Role } from "src/common/enum/role.enum";
import { GlobalKey } from "src/common/globals/globals.enum";
import { GlobalsService } from "src/common/globals/globals.service";
import { checkStringExistence } from "src/common/validators/custom.validator";
import { CountrymodelService } from "src/countrymodel/countrymodel.service";
import { TerritorySummaryDto } from "src/countrymodel/dto/territory.dto";
import { TerritoryDocument } from "src/countrymodel/schema/territory.schema";
import { COUNTRY_TERRITORY_ID, TerritoryType } from "src/countrymodel/types/territory.type";
import { User } from "src/profile/user/types/user.type";
import { UserService } from "src/profile/user/user.service";
import { StatusService } from "src/status/status.service";
import { getCurrentDate, getNextOccurrenceOfHourInTimezone } from "src/utils/date-time";
import { cronlogDebug, cronlogError, cronlogInfo, logDebug, logInfo } from "src/utils/logger";
import { decodeCursor, encodeCursor } from "src/utils/pagination";
import { VotingSessionDocument } from "../voting-session/voting-session.schema";
import { VotingSessionService } from "../voting-session/voting-session.service";
import { DecisionDocument, DecisionMongo, PropositionMongo, SubjectMongo } from "./decision.schema";
import { CreateProposalDto } from "./dto/create-proposal.dto";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { DecisionDto, DecisionSummaryDto, DecisionTextDto, MostVotedPropositionAtNowDto } from "./dto/decision.dto";
import { DecisionStatus } from "./types/decision-status.enum";
import { DecisionsCursor, DecisionsFilter, DecisionsSortBy } from "./types/decisions-filter.type";

@Injectable()
export class DecisionService {
  constructor(
    @InjectModel(DecisionMongo.name) private readonly decisionModel: Model<DecisionMongo>,
    private readonly votingSessionService: VotingSessionService,
    private readonly chatService: ChatService,
    private readonly aiService: AiService,
    private readonly emailService: EmailService,
    private readonly globalsService: GlobalsService,
    private readonly statusService: StatusService,
    private readonly countryModelService: CountrymodelService,
    private readonly userService: UserService,
    private eventEmitter: EventEmitter2
  ) {}

  private ai_user: User = { _id: "000000000000000000000000", email: "ai@baztille.org" } as User; // Fake user ID for AI generated content

  /**
   * Finds all decisions matching the given filter.
   * Not paginated !! Must be used with care (please use searchDecisions instead when possible)
   * @returns {Promise<any[]>} An array containing all decisions.
   */
  findDecisions(filter: DecisionsFilter): Promise<DecisionDocument[]> {
    //logInfo(filter);

    const mongoFilter: mongoose.FilterQuery<DecisionDocument> = {};

    if (filter.status) {
      mongoFilter.status = filter.status;
    }

    let mongoLimit = 10;
    if (filter.limit) {
      mongoLimit = Math.min(filter.limit, 100);
    } // Note: do not return more than 100 results

    return this.decisionModel
      .find(mongoFilter, {
        status: 1,
        territory: 1,
        decisionDate: 1,
        "subject.text": 1,
        "subject.theme": 1,
        "mostVotedProposition.text": 1
      })
      .sort({ decisionDate: -1 })
      .limit(mongoLimit);
  }

  /**
   * Finds all decisions matching the given filter.
   * Reponse is paginated
   * @returns {Promise<any[]>} An array containing all decisions.
   */
  async searchDecisions(
    filter: DecisionsFilter,
    currentUser?: User
  ): Promise<{ decisions: DecisionSummaryDto[]; nextAfter: string | null }> {
    //logInfo(filter);

    const mongoFilter: mongoose.FilterQuery<DecisionDocument> = {};
    const andConditions: mongoose.FilterQuery<DecisionDocument>[] = [];
    const now = getCurrentDate().getTime();

    if (filter.status) {
      mongoFilter.status = filter.status;

      if (filter.status == DecisionStatus.DECIDED) {
        // For "decided" decisions, return both:
        // - decisions with status "decided"
        // - decisions with status "general vote" that were featured in the past
        // Reason: we want to show all past decisions
        andConditions.push({
          $or: [
            { status: DecisionStatus.DECIDED },
            {
              status: DecisionStatus.GENERAL_VOTE,
              featuredTo: { $lt: now }
            }
          ]
        });
      }
    } else {
      // In any case, exclude "decided" and "cancelled" decisions by default
      mongoFilter.status = { $nin: [DecisionStatus.DECIDED, DecisionStatus.CANCELLED] };
    }

    if (filter.featured) {
      // Only featured decisions at now
      // = featuredFrom <= now
      // featuredTo not set OR now <= featuredTo

      andConditions.push({
        featuredFrom: { $lte: now },
        $or: [{ featuredTo: { $exists: false } }, { featuredTo: { $gte: now } }]
      });
    }

    // Filters by territory (only votable territories where user is member of)
    const territoryIds: mongoose.Types.ObjectId[] = [];
    if (currentUser && currentUser.role !== Role.VISITOR) {
      currentUser.territoriesInfos.forEach((territory) => {
        if (territory.votableTerritory) {
          territoryIds.push(new mongoose.Types.ObjectId(territory._id));
        }
      });

      // If no votable territory found for user, we still add country level decisions
      if (territoryIds.length === 0) {
        territoryIds.push(new mongoose.Types.ObjectId(COUNTRY_TERRITORY_ID));
      }
    } else {
      // No current user => only country level decisions
      territoryIds.push(new mongoose.Types.ObjectId(COUNTRY_TERRITORY_ID));
    }
    mongoFilter["territory"] = { $in: territoryIds };

    let mongoLimit = 10;
    if (filter.limit) {
      mongoLimit = Math.min(filter.limit, 100);
    } // Note: do not return more than 100 results

    if (filter.after) {
      const cursor = decodeCursor<DecisionsCursor>(filter.after);

      logDebug("Decoded cursor for pagination: ", cursor);

      const paginationCondition: mongoose.FilterQuery<DecisionDocument> = {};

      // Return only decisions after this cursor (for pagination), depending on sorting order
      if (filter.sortBy === DecisionsSortBy.FEATURED_LOCAL_HOTNESS_DATE) {
        paginationCondition.$or = [
          { isFeatured: { $lt: cursor.f } }, // lower level for featured
          {
            isFeatured: cursor.f, // or same level for featured, AND :
            $or: [
              { isLocal: { $lt: cursor.l } }, // lower level for local
              {
                isLocal: cursor.l, // or same level for local, AND :
                $or: [
                  { hotnessScore: { $lt: cursor.h } }, // lower hotness
                  {
                    hotnessScore: cursor.h, // or same hotness, AND :
                    $or: [
                      { decisionDate: { $lt: cursor.d } }, // older decision date
                      { decisionDate: cursor.d, _id: { $gt: new mongoose.Types.ObjectId(cursor.id) } } // or same decision date, greater ID
                    ]
                  }
                ]
              }
            ]
          }
        ];

        logDebug("Pagination condition: ", JSON.stringify(paginationCondition));
      } else if (filter.sortBy === DecisionsSortBy.DATE_DESC) {
        paginationCondition.$or = [
          { decisionDate: { $lt: cursor.d } }, // older decision date
          { decisionDate: cursor.d, _id: { $gt: new mongoose.Types.ObjectId(cursor.id) } } // or same decision date, greater ID
        ];
      } else {
        // Error
        throw new BadRequestException("Invalid sortBy value");
      }

      andConditions.push(paginationCondition);
    }

    // Combine all conditions
    if (andConditions.length > 0) {
      mongoFilter.$and = andConditions;
    }

    logDebug("Mongo filter before searchText: ", JSON.stringify(mongoFilter));

    // Sorting stage
    let sortStage: mongoose.PipelineStage;
    if (filter.sortBy === DecisionsSortBy.FEATURED_LOCAL_HOTNESS_DATE) {
      sortStage = {
        $sort: {
          isFeatured: -1,
          isLocal: -1,
          hotnessScore: -1,
          decisionDate: -1,
          _id: 1
        }
      };
    } else if (filter.sortBy === DecisionsSortBy.DATE_DESC) {
      sortStage = {
        $sort: {
          decisionDate: -1,
          _id: 1
        }
      };
    } else {
      // Error
      throw new BadRequestException("Invalid sortBy value");
    }

    const pipeline: mongoose.PipelineStage[] = [
      // Add isFeatured field
      {
        $addFields: {
          isFeatured: {
            $cond: {
              if: {
                $and: [
                  { $ne: [{ $type: "$featuredFrom" }, "missing"] },
                  {
                    $or: [{ $eq: [{ $type: "$featuredTo" }, "missing"] }, { $gte: ["$featuredTo", now] }]
                  }
                ]
              },
              then: 1,
              else: 0
            }
          }
        }
      },

      // Add isLocal field (isLocal = true if territory ID is not country)
      {
        $addFields: {
          isLocal: {
            $cond: {
              if: { $ne: ["$territory", new mongoose.Types.ObjectId(COUNTRY_TERRITORY_ID)] },
              then: 1,
              else: 0
            }
          }
        }
      },

      // Match stage - apply filters
      {
        $match: mongoFilter
      },

      // Lookup territory information
      {
        $lookup: {
          from: "c_territory",
          let: { territoryId: "$territory" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$territoryId"] }
              }
            },
            {
              $lookup: {
                from: "c_territory_type",
                localField: "type",
                foreignField: "_id",
                as: "type"
              }
            },
            {
              $unwind: "$type"
            },
            {
              $project: {
                _id: 1,
                name: 1,
                type: 1,
                votableTerritory: 1
              }
            }
          ],
          as: "territory"
        }
      },
      {
        $unwind: "$territory"
      },

      // Project only needed fields
      {
        $project: {
          status: 1,
          territory: 1,
          decisionDate: 1,
          creationDate: 1,
          subjectSelectionDate: 1,
          propositionsSelectionDate: 1,
          "subject.text": 1,
          "subject.theme": 1,
          "mostVotedProposition.text": 1,
          propositionsSelectionVotesession: 1,
          generalVoteVotesession: 1,
          submittedPropositions: 1,
          propositions: 1,
          hotnessScore: 1,
          featuredFrom: 1,
          featuredTo: 1,
          isFeatured: 1,
          isLocal: 1
        }
      },

      // Sort
      sortStage,

      // Limit
      {
        $limit: mongoLimit
      }
    ];

    const decisionsList = await this.decisionModel.aggregate(pipeline).exec();

    //logDebug("Mongo filter used: ", JSON.stringify(mongoFilter) );
    //logDebug("Decisions list retrieved: ", decisionsList);

    // Build typed response: only expose fields defined in DecisionSummaryDto
    const result: DecisionSummaryDto[] = decisionsList.map((decision) => {
      logDebug("Processing decision " + decision._id + " with subject " + decision.subject?.text);

      const territory: TerritorySummaryDto = {
        _id: decision.territory._id.toString(),
        name: decision.territory.name,
        type: decision.territory.type as unknown as TerritoryType, // Due to populate
        isVotable: decision.territory.votableTerritory ? decision.territory.votableTerritory.votableDecisions : false,
        currentFeaturedDecisionTrigger: decision.territory.votableTerritory
          ? decision.territory.votableTerritory.currentFeaturedDecisionTrigger
          : 0,
        chatroomId: decision.territory.votableTerritory ? decision.territory.votableTerritory.chatroomId : undefined
      };

      return {
        _id: decision._id.toString(),
        status: decision.status,
        territory: territory,
        creationDate: decision.creationDate,
        subjectSelectionDate: decision.subjectSelectionDate,
        propositionsSelectionDate: decision.propositionsSelectionDate,
        decisionDate: decision.decisionDate,
        subject: decision.subject?.text ?? "",
        propositionsSelectionVotesession: decision.propositionsSelectionVotesession,
        hotnessScore: decision.hotnessScore ?? 0,
        featuredFrom: decision.featuredFrom,
        featuredTo: decision.featuredTo,
        generalVoteVotesession: decision.generalVoteVotesession ?? undefined,
        userHasVoted: false,
        mostVotedPropositionAtNow: undefined,
        nbrSubmittedPropositions: decision.submittedPropositions.length
      };
    });

    ////////////////////////////////////////////////////////////////////////////////////////////
    // Now, get decisions for which current user voted (to add "userHasVoted" flag)
    if (currentUser && currentUser.role !== Role.VISITOR) {
      // Start by extracting voting session IDs
      const decisionToVotingSessionIdMap: { [key: string]: string } = {};
      const allVotingSessionIds: string[] = [];
      for (const i in decisionsList) {
        const decision = decisionsList[i];

        //logDebug("Processing decision ", decision._id, " with status ", decision.status );

        if (decision.status == DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL) {
          decisionToVotingSessionIdMap[decision._id.toString()] = decision.propositionsSelectionVotesession.toString();
          allVotingSessionIds.push(decision.propositionsSelectionVotesession.toString());
        } else if (decision.generalVoteVotesession != null) {
          // In any other case, use general vote voting session (if any)
          decisionToVotingSessionIdMap[decision._id.toString()] = decision.generalVoteVotesession.toString();
          allVotingSessionIds.push(decision.generalVoteVotesession.toString());
        }
      }

      //logDebug("Decision to voting session map: ", decisionToVotingSessionIdMap );
      // Get current user vote for all these voting sessions
      const userVotes = await this.votingSessionService.getUserVoteForMultipleDecisions(
        allVotingSessionIds,
        currentUser
      );
      //logDebug("User votes map: ", userVotes );

      // Now, update decisions list to add "userHasVoted" flag for relevant decisions
      for (const i in decisionsList) {
        const votingSessionId = decisionToVotingSessionIdMap[decisionsList[i]._id.toString()];
        //logDebug("Checking decision "+ decisionsList[i]._id.toString()+ " with voting session "+ votingSessionId );
        if (userVotes.find((session_id) => session_id === votingSessionId)) {
          //logDebug("User has voted for decision "+ decisionsList[i]._id.toString() );
          result[i].userHasVoted = true;
        }
      }
    }

    //////////////////////////////////////////////////////////////////////////////////
    // Now, for each decision where user voted (or vote has ended), get the current most voted proposition + percent of votes
    for (const i in decisionsList) {
      const decision = decisionsList[i];
      if (result[i].userHasVoted || decision.status == DecisionStatus.DECIDED) {
        const mostVotedPropositionAtNow = await this.getMostVotedPropositionAtNow(decision);

        if (mostVotedPropositionAtNow) {
          result[i].mostVotedPropositionAtNow = mostVotedPropositionAtNow;
        }
      }
    }

    //////////////////////////////////////////////////////////////////////////////////
    // Finish building response
    const lastDecision = decisionsList.at(-1);

    logDebug("Last decision in paginated list: ", {
      id: lastDecision?._id,
      isFeatured: lastDecision?.isFeatured,
      isLocal: lastDecision?.isLocal,
      hotnessScore: lastDecision?.hotnessScore,
      decisionDate: lastDecision?.decisionDate
    });

    const nextAfter = lastDecision
      ? encodeCursor({
          id: lastDecision._id.toString(),
          f: lastDecision.isFeatured,
          l: lastDecision.isLocal,
          h: lastDecision.hotnessScore,
          d: lastDecision.decisionDate
        })
      : null; // Case where there are no more items

    return {
      decisions: result,
      nextAfter: nextAfter
    };
  }

  /**
   * Get most voted proposition for a decision at now
   * @param decision decision as taken from the database
   */
  async getMostVotedPropositionAtNow(decision: {
    status: DecisionStatus;
    propositionsSelectionVotesession: string;
    generalVoteVotesession: string | null;
    submittedPropositions: PropositionMongo[];
    propositions: PropositionMongo[];
  }): Promise<MostVotedPropositionAtNowDto | null> {
    //logDebug("Getting most voted proposition at now for decision ", decision._id);
    // Determine which voting session to use

    let target_votesession_id: string | null = null;
    if (decision.status == DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL) {
      target_votesession_id = decision.propositionsSelectionVotesession.toString();
    } else if (decision.status == DecisionStatus.GENERAL_VOTE || decision.status == DecisionStatus.DECIDED) {
      target_votesession_id = decision.generalVoteVotesession ? decision.generalVoteVotesession.toString() : null;
    }

    if (target_votesession_id == null) {
      return null;
    }

    const votesession_results = await this.votingSessionService.getVotingSessionResultsSummary(target_votesession_id);
    if (votesession_results.results.length > 0) {
      //logDebug("Votesession results: ", votesession_results.results);

      const top_choice = votesession_results.results[0];

      let top_choice_text = "";
      // Get text of this proposition
      if (decision.status == DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL) {
        // Find in submitted propositions the one matching top_choice.choice
        for (const j in decision.submittedPropositions) {
          if (decision.submittedPropositions[j]._id.toString() == top_choice.choice) {
            top_choice_text = decision.submittedPropositions[j].text;
            break;
          }
        }
      } else if (decision.status == DecisionStatus.GENERAL_VOTE || decision.status == DecisionStatus.DECIDED) {
        //logDebug("Looking for proposition text in general vote propositions");
        // Find in propositions the one matching top_choice.choice
        for (const j in decision.propositions) {
          //logDebug("Checking proposition ", decision.propositions[j]._id.toString());
          if (decision.propositions[j]._id.toString() == top_choice.choice) {
            top_choice_text = decision.propositions[j].text;
            break;
          }
        }
      }

      //logDebug("Top choice text: ", top_choice_text);

      return {
        text: top_choice_text,
        votes: top_choice.votes,
        totalVoters: votesession_results.votersCount
      };
    } else {
      return null;
    }
  }

  /**
   * Finds a decision by its ID.
   * @param {string} id - The ID of the decision to find.
   * @returns {Promise<any>} The decision with the specified ID.
   * @throws {HttpException} Throws an HTTP exception if the decision is not found.
   */
  getDecisionById(id: string): Promise<DecisionDocument | null> {
    return this.decisionModel.findById(id);
  }

  /**
   * Retrieve all what is needed to display a decision (from decision ID), including all current items that concern vote in progress
   * (all subjects in step 1, all propositions in step 2, 4 propositions in step 3) + current user voting element (ballot number, ...).
   * @param {string} id - The ID of the decision to find.
   * @returns {Promise<Decision>} The decision with the specified ID.
   * @throws {HttpException} Throws an HTTP exception if the decision is not found.
   */
  async getDecision(decisionId: string, bOnlyBasicInfos = false): Promise<DecisionDto> {
    const decision = await this.decisionModel
      .findById(decisionId)
      .populate<{ territory: TerritoryDocument }>({
        path: "territory",
        select: "name type votableTerritory",
        populate: {
          path: "type",
          model: "TerritoryTypeMongo"
        }
      })
      .lean();

    if (!decision) {
      throw new Error("Decision not found: " + decisionId);
    }

    //logDebug("Decision found: ", decision);

    const result: DecisionDto = new DecisionDto();

    // Map basic fields
    result._id = decision._id.toString();
    result.status = decision.status;
    result.territory = {
      _id: decision.territory._id.toString(),
      name: decision.territory.name,
      type: decision.territory.type as unknown as TerritoryType, // Due to populate
      isVotable: decision.territory.votableTerritory ? decision.territory.votableTerritory.votableDecisions : false,
      currentFeaturedDecisionTrigger: decision.territory.votableTerritory
        ? decision.territory.votableTerritory.currentFeaturedDecisionTrigger
        : 0
    };
    result.creationDate = decision.creationDate;
    result.subjectSelectionDate = decision.subjectSelectionDate;
    result.propositionsSelectionDate = decision.propositionsSelectionDate;
    result.decisionDate = decision.decisionDate;
    result.subject = decision.subject?.text ?? "";
    result.propositionsSelectionVotesession = decision.propositionsSelectionVotesession;
    result.hotnessScore = decision.hotnessScore ?? 0;
    result.featuredFrom = decision.featuredFrom;
    result.featuredTo = decision.featuredTo;
    result.generalVoteVotesession = decision.generalVoteVotesession ?? undefined;
    result.nbrSubmittedPropositions = decision.submittedPropositions.length;

    // Return current verison of submitted propositions
    result.submittedPropositions = decision.submittedPropositions.map((proposition) => {
      return {
        text: proposition.text,
        _id: proposition._id,
        creationDate: proposition.versions[0]?.creationDate
      };
    });

    // Return current version of propositions
    result.propositions = decision.propositions.map((proposition) => {
      return {
        text: proposition.text,
        _id: proposition._id,
        creationDate: proposition.versions[0]?.creationDate
      };
    });

    if (bOnlyBasicInfos) {
      return result;
    }

    // Add votes on propositions
    const propositionSelectionResults = await this.votingSessionService.getVotingSessionResultsSummary(
      decision.propositionsSelectionVotesession
    );

    result.propositionsSelectionVotesessionResults = {
      votersCount: propositionSelectionResults.votersCount,
      results: propositionSelectionResults.results
    };

    // Add votes on general votes
    const generalVoteResults = decision.generalVoteVotesession
      ? await this.votingSessionService.getVotingSessionResultsSummary(decision.generalVoteVotesession)
      : null;

    if (generalVoteResults) {
      result.generalVoteVotesessionResults = {
        votersCount: generalVoteResults.votersCount,
        results: generalVoteResults.results
      };
    }

    if (result.status == DecisionStatus.SUGGEST_AND_VOTE_SUBJECT) {
      // Step 1 => add infos specific to step 1
    } else if (result.status == DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL) {
      // Step 2 => add infos specific to step 2
    } else if (result.status == DecisionStatus.GENERAL_VOTE) {
      // Step 3 => add infos specific to step 3
    }

    //logDebug( result );

    return result;
  }

  /**
   * Removes a decision by its ID.
   * @param {string} id - The ID of the decision to remove.
   * @returns {Promise<any>} A promise indicating the result of the removal operation.
   * @throws {HttpException} Throws an HTTP exception if an error occurs during the removal operation.
   */
  remove(id: string): void {
    this.decisionModel.deleteOne({ _id: id });
  }

  /**
   * Retrieves the current active decision with the given status from the database.
   * @param {DecisionStatus} status - The status of the decision to retrieve.
   * @param {Object} options - Additional options for the retrieval.
   *        if options.after_end_check is true, the decision end time is checked to ensure it is in the past.
   * @returns {Promise<Decision>} A promise resolving to the current active decision.
   * @throws {HttpException} Throws an HTTP exception if an error occurs during the retrieval process.
   */
  getCurrentDecision(
    status: DecisionStatus,
    options?: { after_end_check?: boolean }
  ): Promise<DecisionDocument | null> {
    let start = "creationDate";
    let end = "decisionDate";

    if (status == DecisionStatus.SUGGEST_AND_VOTE_SUBJECT) {
      start = "creationDate";
      end = "subjectSelectionDate";
    } else if (status == DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL) {
      start = "subjectSelectionDate";
      end = "propositionsSelectionDate";
    } else if (status == DecisionStatus.GENERAL_VOTE) {
      start = "propositionsSelectionDate";
      end = "decisionDate";
    }

    let endTimeCheck = "$gt"; // By default, we check that end time is greater than current date
    if (options && options.after_end_check) {
      endTimeCheck = "$lt"; // If "after_end_check" option is set, we check that end time is in the past
    }

    const filter = {
      $and: [
        {
          [start]: {
            $lt: getCurrentDate().getTime()
          }
        },
        {
          [end]: {
            [endTimeCheck]: getCurrentDate().getTime()
          }
        },
        {
          status: status
        }
      ]
    };

    logInfo(filter);

    return this.decisionModel.findOne(filter);
  }

  /**
   * Retrieves the current active decisions (all status - except "archived") from the database.
   *    In case there is a maintenance in progress (= no possible votes), the response will contain a "maintenance" member set to true.
   * @returns {Promise<ActiveDecisions>} Current and future decisions.
   * @throws {HttpException} Throws an HTTP exception if an error occurs during the retrieval process.
   */
  /* DEPRECATED because the notion of "active decision" is not relevant anymore
   */
  /*
  async getCurrentActiveDecisions(): Promise<ActiveDecisions> {
    const result: ActiveDecisions = {
      future: null,
      current: null
    };

    const sessions = await this.decisionModel
      .find(
        {
          $and: [
            {
              creationDate: {
                $lt: getCurrentDate().getTime()
              }
            },
            {
              decisionDate: {
                $gt: getCurrentDate().getTime()
              }
            }
          ]
        },
        "status \
          creationDate subjectSelectionDate propositionsSelectionDate decisionDate \
          subject \
          subjectSelectionVotesession \
          propositionsSelectionVotesession \
          generalVoteVotesession"
      )
      .populate("subject", "title theme");
    for (const i in sessions) {
      const session = sessions[i];

      if (session.status == DecisionStatus.GENERAL_VOTE) {
        result.current = { session: session };
      } else if (
        session.status == DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL ||
        session.status == DecisionStatus.SUGGEST_AND_VOTE_SUBJECT
      ) {
        result.future = { session: session };
      }
    }

    return result;
  }*/

  /**
   * Add a new subject using the provided data.
   * @param {CreateSubjectDto} createSubjectDto - The data to create the subject with.
   * @returns {Promise<{ id: string }>} The new decision ID created with this subject
   * @throws {BadRequestException} Throws a 400 Bad Request error if the provided subject fields are invalid or missing.
   * @throws {ConflictException} Throws a 409 Conflict error if a subject with the same title already exists.
   * @throws {Error} Throws any other error that occurs during the creation process.
   */
  async submitSubject(createSubjectDto: CreateSubjectDto, user: User): Promise<{ id: string }> {
    logDebug("Ready to add subject with data: ", createSubjectDto);

    if (!createSubjectDto.territoryId) {
      // No territory provided = old client version => tell the user to update his app
      throw new Error(
        "You must update your application to the latest version in order to submit subjects. Please update and try again."
      );
    }

    const subject_author_id = user._id;

    // Check if title is valid
    if (!checkStringExistence(createSubjectDto.title) && !checkStringExistence(createSubjectDto.theme)) {
      throw new Error("Invalid or missing subject field");
    }

    // Check if user did not submit a subject recently (one subject every 7 days)
    if (await this.hasSubmittedSubject(user)) {
      throw new Error("You can submit only one subject every 7 days. Please wait before submitting a new subject.");
    }

    // Create a new decision to host this subject

    // Check if there is no maintenance in progress preventing us to create a new decision
    const maintenance = await this.statusService.getMaintenanceStatus();
    if (maintenance && maintenance.voteCycle === false) {
      throw Error("Cannot submit subject: there is a maintenance in progress preventing us to create a new decision");
    }

    const rootTerritory = createSubjectDto.territoryId;

    // Check that this territory exists and is "votable"
    const bIsVotable = await this.countryModelService.isVotable(rootTerritory);
    if (!bIsVotable) {
      throw new Error("The provided territory is not votable");
    }

    // Check that current user is member of this territory
    const isMember = user.territoriesInfos.find((territoryInfo) => {
      return territoryInfo._id.toString() == rootTerritory;
    });
    if (!isMember) {
      logDebug("User is not member of territory ", rootTerritory);
      logDebug("User territories: ", user.territoriesInfos);

      throw new Error("You must be member of the provided territory to submit a subject for it");
    }

    const creationDate = getCurrentDate();

    // Create subject object
    const subject_id = new mongoose.Types.ObjectId();
    const subject: SubjectMongo = {
      _id: subject_id.toString(),
      text: createSubjectDto.title,
      theme: createSubjectDto.theme,
      author: subject_author_id,
      versions: [
        {
          text: createSubjectDto.title,
          author: subject_author_id,
          creationDate: getCurrentDate().getTime()
        }
      ]
    };

    // Create voting sessions (only for propositions submission for now)
    const voteSession_propositions_id = await this.votingSessionService.createVotingSession(
      rootTerritory,
      DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL,
      creationDate.valueOf(),
      null,
      1
    );

    const newDecision = new this.decisionModel({
      status: DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL,
      territory: rootTerritory,
      creationDate: creationDate,
      subjectSelectionDate: creationDate,
      propositionsSelectionDate: null,
      decisionDate: null,
      subjectSelectionVotesession: null,
      propositionsSelectionVotesession: voteSession_propositions_id,
      generalVoteVotesession: null,
      subject: subject
    });

    newDecision.save();

    cronlogInfo("New decision created:");
    cronlogInfo(newDecision);

    const decisionId = newDecision._id;

    //logInfo( subject );

    await this.decisionModel.findOneAndUpdate(
      { _id: decisionId },
      {
        $push: {
          submittedSubjects: subject
        }
      }
    );

    logInfo(subject_id);

    // Increment user activity stat (number of submitted subjects)
    logDebug("User " + user._id + " submitted a new subject (updating stat)");
    this.userService.incrementUserActivityStat(user._id, "votesNextSubject_nbr", 1);

    if (!user.activity || !user.activity.votesNextSubject_nbr || user.activity.votesNextSubject_nbr == 0) {
      // First subject submitted => trigger missions check
      this.eventEmitter.emit(InternalEventsEnum.USER_CHECK_MISSIONS_FOR_USER, { userId: user._id });
    }

    // Initialize debate context for this subject
    this.eventEmitter.emit(InternalEventsEnum.DEBATE_INITIALIZE_CONTEXT, { decisionId: decisionId.toString() });

    return { id: decisionId.toString() };
  }

  /**
   * Add a new proposition using the provided data.
   * @param {CreateProposalDto} createPropositionDto - The data to create the subject with.
   * @param {User} user - The user submitting the proposition.
   * @param {string} [forceUserId] - Optional parameter to force the user ID (used for testing only).
   * @returns {Promise<Proposition>} A promise that resolves to the created proposition.
   */
  async submitProposition(
    createPropositionDto: CreateProposalDto,
    user: User,
    forceUserId?: string
  ): Promise<{ id: string }> {
    // Set user
    const proposition_author_id = user._id;

    // Get info about decision
    const decision = await this.getDecisionById(createPropositionDto.decisionId);

    if (!decision) {
      throw new Error("submitProposition: decision not found: " + createPropositionDto.decisionId);
    }

    if (decision.status != DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL) {
      throw new Error("submitProposition: propositions submission is not allowed at this time for this decision");
    }

    const decisionId = createPropositionDto.decisionId;

    logInfo("Ready to add proposition with data: ", createPropositionDto);

    // Check if title is valid
    if (!checkStringExistence(createPropositionDto.title)) {
      throw new Error("Invalid or missing proposition field");
    }

    // Check if user did not submit a proposition yet
    if (!forceUserId) {
      if (await this.hasSubmittedProposition(user, createPropositionDto.decisionId)) {
        throw new Error("You can submit only one proposition for each decision.");
      }
    }

    // Add this proposition in Decision object
    const proposition_id = new mongoose.Types.ObjectId();
    const proposition: PropositionMongo = {
      _id: proposition_id.toString(),
      text: createPropositionDto.title,
      author: proposition_author_id,
      versions: [
        {
          text: createPropositionDto.title,
          author: forceUserId ? forceUserId : proposition_author_id,
          creationDate: getCurrentDate().getTime()
        }
      ]
    };

    logInfo(proposition);

    await this.decisionModel.findOneAndUpdate(
      { _id: decisionId },
      {
        $push: {
          submittedPropositions: proposition
        }
      }
    );

    // Add this subject as a voting possibility in corresponding Voting Session
    // Note: tiebreaker is the timestamp (= more recent subject have priority in case of tie)
    await this.votingSessionService.addChoice(
      decision.propositionsSelectionVotesession,
      proposition_id.toString(),
      getCurrentDate().getTime()
    );

    // Increment user activity stat (number of submitted propositions)
    logDebug("User " + user._id + " submitted a new proposition (updating stat)");
    this.userService.incrementUserActivityStat(user._id, "votesNextPropositions_nbr", 1);

    if (!user.activity || !user.activity.votesNextPropositions_nbr || user.activity.votesNextPropositions_nbr == 0) {
      // First proposition submitted => trigger missions check
      this.eventEmitter.emit(InternalEventsEnum.USER_CHECK_MISSIONS_FOR_USER, { userId: user._id });
    }

    // Update hotness score for this decision
    this.updateHotnessScore(decisionId);

    // (asynchrounously) using AI, generate 3 arguments for and 3 arguments against this proposition
    this.eventEmitter.emit(InternalEventsEnum.AI_GENERATE_PROPOSITION_ARGUMENTS, {
      propositionId: proposition_id.toString(),
      decisionId: decisionId
    });

    return { id: proposition_id.toString() };
  }

  /**
   * On a new vote:
   * - increment voter's count for the decision
   * - update hotness score for the decision
   */
  @OnEvent(InternalEventsEnum.VOTE_NEW_VOTE, { async: true })
  async handleNewVote(payload: { votingSessionId: string }) {
    logInfo("Event received: newVote for voting session " + payload.votingSessionId);

    // Get decision corresponding to this voting session
    const decision = await this.decisionModel.findOne(
      {
        $or: [
          { propositionsSelectionVotesession: payload.votingSessionId },
          { generalVoteVotesession: payload.votingSessionId }
        ]
      },
      "_id "
    );

    if (!decision) {
      logInfo("handleNewVote: no decision found for voting session " + payload.votingSessionId);
      return;
    }

    // Generate a timestamp for today at midnight (to group all votes of the same day)
    const now = getCurrentDate();
    const today_midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // Increment voter's count for today (votingActivity map)
    const votingActivityKey = `votingActivity.${today_midnight}`;
    await this.decisionModel.updateOne({ _id: decision._id }, { $inc: { [votingActivityKey]: 1 } });

    logInfo("Incremented voting activity for decision " + decision._id + " at " + today_midnight);

    // Triggering hotness score recalculation
    this.updateHotnessScore(decision._id);
  }

  /**
   * Update hotness score for a decision
   * Then, trigger "hotness score trigger check" for this decision on this territory
   * @param decisionId
   */
  async updateHotnessScore(decisionId: string) {
    logInfo("Updating hotness score for decision " + decisionId);

    // Get voting activity for this decision + number of submittedPropositions
    const decision = await this.decisionModel.findById(decisionId, "votingActivity submittedPropositions featuredFrom");
    if (!decision) {
      logInfo("updateHotnessScore: decision not found: " + decisionId);
      return;
    }

    // Calculate hotness score
    let hotnessScore = 0;

    // Add voting activity (sum of all votes in the last 7 days)
    const now = getCurrentDate().getTime();
    const seven_days_ago = now - 7 * 24 * 60 * 60 * 1000;
    //logDebug("Calculating hotness score: now=" + now + ", seven_days_ago=" + seven_days_ago);
    //logDebug("Voting activity: ", decision.votingActivity);

    decision.votingActivity.forEach((votesNbr, timestamp_str) => {
      const timestamp = parseInt(timestamp_str);
      //logDebug("Compare timestamp " + timestamp + " with seven_days_ago " + seven_days_ago);
      if (timestamp >= seven_days_ago) {
        //logDebug("Adding voting activity for timestamp " + timestamp + ": " + votesNbr);
        hotnessScore += votesNbr;
      }
    });

    // Substract -250 points per submitted proposition missing from 4 (to encourage having 4 propositions)
    const nbr_missing_propositions = Math.max(0, 4 - decision.submittedPropositions.length);
    hotnessScore -= nbr_missing_propositions * 250;

    logInfo(
      `Calculated hotness score for decision ${decisionId}: ${hotnessScore} (missing propositions: ${nbr_missing_propositions})`
    );

    // Add 10000 points if the decision is featured or planned to be (so that these decisions are always on top)
    if (decision.featuredFrom) {
      hotnessScore += 10000;
    }

    // Update decision
    await this.decisionModel.updateOne({ _id: decisionId }, { $set: { hotnessScore: hotnessScore } });

    // Check decision hotness (only if it has not been featured yet)
    if (!decision.featuredFrom) {
      this.checkDecisionHotness(decisionId);
    } else {
      logDebug("Decision " + decisionId + " is already featured, skipping hotness check");
    }
  }

  /**
   * Check if a decision has a hotness score greater than the hotness threshold defined for its territory
   * If a decision is over the threshold, update it to be featured in +4 days and reset territory treshold
   * @param decisionId (optional) if specified, check only this decision
   * @returns {boolean} true if hotness score is greater than threshold
   */
  @OnEvent(InternalEventsEnum.TERRITORY_FEATURED_DECITIONS_TRIGGER_UPDATE, { async: true })
  async checkDecisionHotness(decisionId?: string): Promise<void> {
    // For all decisions, we must get the territory hotness threshold and compare it to the decision hotness score, using a mongo query aggregation pipeline
    logInfo("Checking decision hotness" + (decisionId ? " for decision " + decisionId : "for all decisions"));
    const filter: mongoose.FilterQuery<DecisionDocument> = {
      featuredFrom: { $eq: null } // Only decisions not already featured
    };
    if (decisionId) {
      filter._id = new mongoose.Types.ObjectId(decisionId);
    }

    // Building aggregation pipeline
    const pipeline: mongoose.PipelineStage[] = [
      {
        $match: filter
      },
      {
        $lookup: {
          from: "c_territory",
          let: { territoryId: "$territory" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$_id", "$$territoryId"] }
              }
            },
            {
              $project: { "votableTerritory.currentFeaturedDecisionTrigger": 1, _id: 1 } // Only need hotnessThreshold and _id field
            }
          ],
          as: "territory_info"
        }
      },
      {
        $unwind: {
          path: "$territory_info",
          preserveNullAndEmptyArrays: false // Skip documents where territory not found
        }
      },
      {
        $match: {
          $expr: { $gte: ["$hotnessScore", "$territory_info.votableTerritory.currentFeaturedDecisionTrigger"] } // Only decisions over threshold
        }
      },
      {
        $project: {
          _id: 1,
          hotnessScore: 1,
          territory_currentFeaturedDecisionTrigger: "$territory_info.votableTerritory.currentFeaturedDecisionTrigger",
          territory_id: "$territory_info._id"
        }
      },
      {
        $sort: { hotnessScore: -1 } // Process higher hotness score first
      }
    ];

    //logDebug(pipeline);

    const decisionsOverThreshold = await this.decisionModel.aggregate(pipeline).exec();

    // Process all decisions over threshold
    // Note: we may process a maximum of one decision per territory at a time (as we reset the threshold after featuring a decision)
    const processedTerritories: Set<string> = new Set<string>();
    for (const i in decisionsOverThreshold) {
      const decision = decisionsOverThreshold[i];
      logInfo(
        `Decision ${decision._id} is over hotness threshold (${decision.hotnessScore} >= ${decision.territory_currentFeaturedDecisionTrigger}) - featuring it now`
      );

      // Check if we already processed a decision for this territory
      if (processedTerritories.has(decision.territory_id.toString())) {
        logInfo(
          `Skipping decision ${decision._id} as we already processed a decision for territory ${decision.territory_id}`
        );
        continue;
      }
      processedTerritories.add(decision.territory_id.toString());

      // Update decision to be featured in +4 days (for now, no ending date), at noon (timezone for cronjobs)
      const now = getCurrentDate();
      const timezone = process.env.TIMEZONE_FOR_CRONJOBS || "UTC";
      const featuredFrom = getNextOccurrenceOfHourInTimezone(now, 4, 12, timezone).getTime();

      await this.decisionModel.updateOne(
        { _id: decision._id },
        {
          $set: {
            featuredFrom: featuredFrom
          }
        }
      );

      logInfo(`Decision ${decision._id} is now featured from ${featuredFrom}`);

      // Update decision hotness (some points are being added when featured)
      // Note: this will not trigger another time this hotness check as the decision is now featured (and we check only non-featured decisions)
      await this.updateHotnessScore(decision._id);

      // Reset territory hotness treshold
      const newTerritoryThreshold = await this.countryModelService.resetTerritoryHotnessScore(
        decision.territory_id,
        decision.hotnessScore
      );

      logInfo(
        `Territory ${decision.territory_id} hotness threshold updated to ${newTerritoryThreshold} after decision ${decision._id} featuring`
      );

      // Trigger notifications, and so on, using internal event
      this.eventEmitter.emit(InternalEventsEnum.DECISION_NEW_DECISION_TO_BE_FEATURED, { decisionId: decision._id });
    }

    logInfo("Decision hotness check completed");
  }

  /**
   * Add 4 new subjects (using AI) in order to avoid having an empty subject list when there is a new decision
   * @returns {bool} true if success
   */
  // DEPRECATED - subjects are not suggested using AI anymore
  /*async fillSubjectUsingAI() {
    // Trigger "get 4 sujects" ai
    const subjects = await this.aiService.getSubjects();

    // Now, insert new subjects, one by one
    for (const i in subjects) {
      logInfo("Inserting subject: ", subjects[i].subject);
      this.submitSubject(
        {
          title: subjects[i].subject,
          theme: subjects[i].theme
        },
        this.ai_user
      );
    }

    logInfo("Done inserting subject using AI");
  }*/

  /**
   * Add 4 new propositions (using AI) in order to avoid having an empty proposition list when there is a new subject
   * @returns {bool} true if success
   */
  /*
  async fillPropositionsUsingAI() {
    // Get current subject
    const decision = await this.getCurrentActiveDecisions();
    if (!decision.future) {
      throw new Error("fillPropositionsUsingAI: No decision is available at now for propositions submission");
    }
    if (decision.future.session.status != DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL) {
      throw new Error("fillPropositionsUsingAI: No decision is available at now for propositions submission");
    }

    const subject_text = decision.future.session.subject.text;

    // Trigger "get 4 propositions" ai
    const propositions = await this.aiService.getPropositions(subject_text);

    // Now, insert new propositions, one by one
    for (const i in propositions) {
      logInfo("Inserting subject: ", propositions[i].proposition);
      this.submitProposition(
        {
          title: propositions[i].proposition,
          decisionId: decision.future.session._id.toString()
        },
        this.ai_user
      );
    }

    logInfo("Done inserting propositions using AI");
  }*/

  /**
   * Find all decisions with a featuredFrom date in the past and move them to featured status (= general vote phase)
   * Usually triggered every hour by a cronjob
   * @returns void
   */
  moveDecisionsToFeatured() {
    logInfo("Checking for decisions to move to featured status");

    const now = getCurrentDate().getTime();

    this.decisionModel
      .find({
        featuredFrom: { $ne: null, $lte: now },
        status: { $ne: DecisionStatus.GENERAL_VOTE }
      })
      .then(async (decisions) => {
        for (const i in decisions) {
          const decision = decisions[i];
          logInfo("Moving decision " + decision._id + " to featured status (general vote phase)");

          const bDecisionFeatured = await this.moveDecisionToGeneralVotePhase(decision._id.toString());

          if (bDecisionFeatured) {
            logInfo("Decision " + decision._id + " moved to featured status successfully");
            // Trigger whatever is needed after moving decision to featured
            this.eventEmitter.emit(InternalEventsEnum.DECISION_NEW_FEATURED_DECISION, {
              decisionId: decision._id.toString()
            });
          } else {
            logInfo("Decision " + decision._id + " could not be moved to featured status");
          }
        }
      });
  }

  /********************************************************************************
   *                   VOTING SESSION LIFECYCLE JOBS
   *               (triggered automatically to make vote lifecycle progress)
   */

  /**
   * start a new decision (sunday noon / start of Step 1)
   * @returns {bool} true if success
   */
  async voteLifeCycleStartNew(): Promise<boolean> {
    // DEPRECATED - now, decisions are created when users submit subjects
    return false;

    /*  cronlogInfo("STARTING JOB: Creating new decision")

    // Check if there is no maintenance in progress preventing us to create a new decision
    const maintenance = await this.statusService.get_maintenance_status();
    if (maintenance && maintenance.voteCycle === false) {
      cronlogError("There is a maintenance in progress preventing us to create a new decision");
      return false; // As this is a possible situation, do not throw exception
    }

    // Check existing decision (in Step 1 status / choose subject)
    const existDecision = await this.getCurrentDecision( DecisionStatus.SUGGEST_AND_VOTE_SUBJECT );
    if (existDecision) {
      throw new Error("There is already a decision in subject selection phase / aborting");
    }    


    let rootTerritory = COUNTRY_TERRITORY_ID; // For now: create only decisions for the whole country

    // Set decision key dates
    const creationDate = moment().tz(process.env.TIMEZONE_FOR_CRONJOBS ?? 'Europe/Paris').set({ hour: 12, minute: 0, second: 0, millisecond: 0 });

    // Set creation date to a test date
    //const creationDate = moment( new Date('23 March 2025 11:00:00') ).tz(process.env.TIMEZONE_FOR_CRONJOBS);

    const subjectSelectionDate = creationDate.clone().add(3, 'days');
    const propositionsSelectionDate = creationDate.clone().add(1, 'week');
    const decisionDate = creationDate.clone().add(2, 'weeks');

    cronlogInfo("Creation date: "+creationDate.format('YYYY-MM-DD HH:mm:ss') );
    cronlogInfo("Subject selection date: "+subjectSelectionDate.format('YYYY-MM-DD HH:mm:ss'));
    cronlogInfo("Propositions selection date: "+propositionsSelectionDate.format('YYYY-MM-DD HH:mm:ss'));
    cronlogInfo("Decision date: "+decisionDate.format('YYYY-MM-DD HH:mm:ss'));

    // Create voting sessions (3, one for each step of this 3 steps vote)
    const voteSession_subject_id = await this.votingSessionService.createVotingSession( rootTerritory, DecisionStatus.SUGGEST_AND_VOTE_SUBJECT, creationDate.valueOf(), subjectSelectionDate.valueOf(), 1 );
    const voteSession_propositions_id = await this.votingSessionService.createVotingSession( rootTerritory, DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL, subjectSelectionDate.valueOf(), propositionsSelectionDate.valueOf(), 1 );
    const voteSession_general_vote_id = await this.votingSessionService.createVotingSession( rootTerritory, DecisionStatus.GENERAL_VOTE, propositionsSelectionDate.valueOf(), decisionDate.valueOf(), 4 );

    
    let newDecision  = new this.decisionModel ({
      territory: rootTerritory,  
      creationDate: creationDate,
      subjectSelectionDate: subjectSelectionDate,
      propositionsSelectionDate: propositionsSelectionDate,
      decisionDate: decisionDate,
      subjectSelectionVotesession: voteSession_subject_id,
      propositionsSelectionVotesession: voteSession_propositions_id,
      generalVoteVotesession: voteSession_general_vote_id
    });

    newDecision.save();

    cronlogInfo( "New decision created:");
    cronlogInfo( newDecision );

    return true;*/
  }

  /**
   * select top subject (wednesday noon / start of Step 2)
   * @returns {bool} true if success
   */
  async voteLifeCycleSubjectSelection(): Promise<boolean> {
    // DEPRECATED - now, subjects are selected when users submit them
    return false;

    /*

      cronlogInfo("STARTING JOB: Selecting top subject")

      const maintenance = await this.statusService.get_maintenance_status();
      if (maintenance && maintenance.voteCycle === false) {
        cronlogError("There is a maintenance in progress preventing us to select a subject");
        return false; // As this is a possible situation, do not throw exception
      }

      const currentDecision = await this.getCurrentDecision( DecisionStatus.SUGGEST_AND_VOTE_SUBJECT, {after_end_check:true} );
      if ( ! currentDecision ) {

        cronlogError("There is no current active decision in subject selection phase");
        return false;  // As this is a possible situation (even rare), do not throw exception        
      }


      cronlogInfo("Current decision: "+currentDecision._id);
      cronlogInfo("Closing subject selection voting session "+currentDecision.subjectSelectionVotesession );

      await this.votingSessionService.closeVotingSession( currentDecision.subjectSelectionVotesession );
  
      let subjectVoteResults = await this.votingSessionService.getVotingSessionResultsSummary( currentDecision.subjectSelectionVotesession );

      cronlogInfo( subjectVoteResults );
      let subjectOfTheWeekId: string | null = null;

      if (subjectVoteResults.results.length > 0) {
        subjectOfTheWeekId = subjectVoteResults.results[0].choice;

        // Look for this subject
        let subjectOfTheWeek:SubjectMongo | undefined = currentDecision.submittedSubjects.find( (subject) => subject._id == subjectOfTheWeekId );

        if( ! subjectOfTheWeek )
        {
          throw Error("Subject not found: "+subjectOfTheWeekId);
        }

        cronlogInfo("Selected subject: ", subjectOfTheWeek );

        // Update decision status & store subject
        await this.decisionModel.updateOne({_id:currentDecision._id}, { $set: {
          status: DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL,
          subject: subjectOfTheWeek
        }});

        // Publish annoucement about the new subject
        // TODO: make this translatable
        this.chatService.sendAdminAnnouncement( "Un nouveau sujet a été sélectionné pour dimanche prochain: `"+subjectOfTheWeek.text+"`: c'est le moment de faire des propositions.", {
          gotopage: 'vote',
          gotopageLabel: 'MESSAGING.GOTOPAGE_LABEL_SELECT_PROPOSITIONS',
          gotopageArgsargs: {
            screen: 'vote-proposition', 
            params: { decisionId: currentDecision._id }
          },
          doNotNotify: true // Publish in "announcement" but do not send notification about this
        } );        
      }
      else
      {
        // No subject => stop here
        cronlogInfo("No subject to select this week (no candidates)");

        // Set decision as "archived" 
        await this.decisionModel.updateOne({_id:currentDecision._id}, {
          $set: {
            status: DecisionStatus.CANCELLED
          }
        });        

        // TODO: cancel the rest of voting sessions

        return true;
      }

      return true;*/
  }

  /**
   * Move decision to general vote phase:
   * - select 4 top propositions
   * - create general vote voting session with these propositions
   * @param {string} decisionId - The ID of the decision to move to general vote phase.
   * @returns {bool} true if success
   */
  async moveDecisionToGeneralVotePhase(decisionId: string): Promise<boolean> {
    cronlogInfo("Selecting top propositions");

    const maintenance = await this.statusService.getMaintenanceStatus();
    if (maintenance && maintenance.voteCycle === false) {
      cronlogError("There is a maintenance in progress preventing us to select a proposition");
      return false; // As this is a possible situation, do not throw exception
    }

    const currentDecision = await this.getDecision(decisionId);
    if (!currentDecision) {
      cronlogError("moveDecisionToGeneralVotePhase: decision not found: " + decisionId);
      throw Error("moveDecisionToGeneralVotePhase: decision not found: " + decisionId);
    }

    // Check we are in propositions selection phase
    if (currentDecision.status != DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL) {
      cronlogError(
        "moveDecisionToGeneralVotePhase: decision " +
          decisionId +
          " is not in propositions selection phase (current status: " +
          currentDecision.status +
          ")"
      );
      throw Error(
        "moveDecisionToGeneralVotePhase: decision " +
          decisionId +
          " is not in propositions selection phase (current status: " +
          currentDecision.status +
          ")"
      );
    }

    // Check that featuredFrom date is in the past
    const now = getCurrentDate().getTime();
    if (!currentDecision.featuredFrom || currentDecision.featuredFrom >= now) {
      cronlogError(
        "moveDecisionToGeneralVotePhase: decision " +
          decisionId +
          " featuredFrom date is not in the past (featuredFrom: " +
          currentDecision.featuredFrom +
          ")"
      );
      throw Error(
        "moveDecisionToGeneralVotePhase: decision " +
          decisionId +
          " featuredFrom date is not in the past (featuredFrom: " +
          currentDecision.featuredFrom +
          ")"
      );
    }

    cronlogInfo("Closing propositions selection voting session " + currentDecision.propositionsSelectionVotesession);

    await this.votingSessionService.closeVotingSession(currentDecision.propositionsSelectionVotesession);

    const propositionsVoteResults = await this.votingSessionService.getVotingSessionResultsSummary(
      currentDecision.propositionsSelectionVotesession
    );

    // Create general vote voting session now (will be used to add choices later)
    const generalVoteVotesessionId = await this.votingSessionService.createVotingSession(
      currentDecision.territory._id,
      DecisionStatus.GENERAL_VOTE,
      getCurrentDate().getTime(), // Vote starts now
      null, // No end date for now
      4 // For the general vote, max 4 choices
    );

    // Store general vote voting session id in decision
    await this.decisionModel.updateOne(
      { _id: currentDecision._id },
      {
        $set: {
          generalVoteVotesession: generalVoteVotesessionId
        }
      }
    );

    //cronlogInfo( propositionsVoteResults );

    const selectedPropositions: DecisionTextDto[] = [];

    if (propositionsVoteResults.results.length > 0) {
      // Get the four top propositions
      for (let i = 0; i < 4; i++) {
        if (propositionsVoteResults.results[i] && propositionsVoteResults.results[i].choice) {
          const selectedPropositionId = propositionsVoteResults.results[i].choice;
          const selectedProposition = currentDecision.submittedPropositions.find(
            (proposition) => proposition._id == selectedPropositionId
          );

          if (!selectedProposition) {
            throw Error("Proposition not found: " + selectedPropositionId);
          }

          selectedPropositions.push(selectedProposition);

          await this.votingSessionService.addChoice(generalVoteVotesessionId, selectedPropositionId); // Note: no tiebreaker for general vote

          cronlogInfo("Selected proposition: ", propositionsVoteResults.results[i]);
        }
      }

      // Update decision status & store propositions
      await this.decisionModel.updateOne(
        { _id: currentDecision._id },
        {
          $set: {
            status: DecisionStatus.GENERAL_VOTE,
            propositions: selectedPropositions
          }
        }
      );

      // TODO: transfer all votes from propositions selection voting session to general vote voting session for the selected propositions only
    } else {
      // No propositions => should not happen, but in this case, stop here
      cronlogError("No proposition to select for general vote (no candidates)");

      // Set decision as "archived"
      await this.decisionModel.updateOne(
        { _id: currentDecision._id },
        {
          $set: {
            status: DecisionStatus.CANCELLED
          }
        }
      );

      // TODO: cancel the rest of voting sessions

      return true;
    }

    return true;
  }

  /**
   * end of general vote (sunday noon / End of Step 3)
   * @returns {bool} true if success
   */
  async voteLifeCycleEndVote(): Promise<boolean> {
    // DEPRECATED - to be recycled later to finalize general vote when suitable
    return false;

    /*
      cronlogInfo("STARTING JOB: end of general vote")

      const currentDecision = await this.getCurrentDecision( DecisionStatus.GENERAL_VOTE, { after_end_check:true } ); // after_end_check: because at the time the cron is launched, the end period has already ended
      if ( ! currentDecision ) {
        cronlogError("There is no current active decision in general vote phase");
        return false;  // As this is a possible situation (even rare), do not throw exception
      }
  
      cronlogInfo("Current decision: "+currentDecision._id);
      cronlogInfo("Closing general vote voting session "+currentDecision.generalVoteVotesession );
  
      await this.votingSessionService.closeVotingSession( currentDecision.generalVoteVotesession );
  
      let generalVoteResult = await this.votingSessionService.getVotingSessionResultsSummary( currentDecision.generalVoteVotesession );
  
      cronlogInfo( generalVoteResult );
  
      if( generalVoteResult.results.length == 0 )
      { 
        cronlogError("No result found at the end of general vote");
        return false; // As this is a possible situation (no one voted), do not throw exception
      }

      let globalWinningPropositionId = generalVoteResult.results[0].choice;

      // Look for this proposition
      let globalWinningProposition:Proposition | undefined = currentDecision.propositions.find( (proposition) => proposition._id == globalWinningPropositionId );

      if( ! globalWinningProposition )
      {
        throw Error("Proposition not found: "+globalWinningPropositionId);
      }

      cronlogInfo("Global winning proposition: ", globalWinningProposition );

      // Update decision status & store winning proposition
      await this.decisionModel.updateOne({_id:currentDecision._id}, {
        $set: {
          status: DecisionStatus.DECIDED,
          mostVotedPropositionAtNow: globalWinningProposition
        }
      });

      // Publish annoucement about the decision made
      // TODO: make this translatable
      await this.chatService.sendAdminAnnouncement( "Décision prise sur le sujet `"+currentDecision.subject.text+"`: `"+globalWinningProposition.text+"`. Merci à tous les participants au vote !", {
        gotopage: 'vote',
        gotopageLabel: 'MESSAGING.GOTOPAGE_LABEL_SEE_DECISION',
        gotopageArgsargs: {
          screen: 'vote-result',
          params: {
            decisionId: currentDecision._id,
            session_step: 'GENERAL_VOTE',
            not_after_vote: true
          }
        },
        doNotNotify: true   // Publish in "announcements" but do not send notifications about this
      } );        

      // TODO: compute and set "territoryToProposition" = map of where the decision should be applied, by territories

      return true;*/
  }

  /**
   * Check if given user has already submitted a subject in the last 7 days
   * @returns {bool} true if user already submitted a subject
   */
  async hasSubmittedSubject(user: User): Promise<boolean> {
    // Find decision with subject.author = user._id in last 7 days

    if (user._id == this.ai_user._id) {
      // AI user is allowed to submit multiple subjects
      return false;
    }

    // Admin users are allowed to submit multiple subjects
    if (user.role == Role.ADMIN) {
      return false;
    }

    const result = await this.decisionModel.find(
      {
        creationDate: { $gt: getCurrentDate().getTime() - 7 * 24 * 60 * 60 * 1000 },
        "subject.author": user._id
      },
      {
        status: 1
      }
    );

    if (process.env.DISABLE_SUBJECTS_PROPOSALS_LIMITS) {
      logInfo("hasSubmittedSubject: subjects/propositions limits are disabled by configuration");
      logInfo("Whe should have returned: ", result.length > 0);

      return false;
    }

    return result.length > 0;
  }

  /**
   * Check if given user has already submitted a proposition for this decisionId
   * @returns {bool} true if user already submitted a proposition
   */
  async hasSubmittedProposition(user: User, decisionId: string) {
    if (user._id == this.ai_user._id) {
      // AI user is allowed to submit multiple propositions
      return false;
    }

    // Admin users are allowed to submit multiple propositions
    if (user.role == Role.ADMIN) {
      return false;
    }

    const result = await this.decisionModel.find(
      {
        _id: decisionId,
        submittedPropositions: {
          $elemMatch: { author: user._id }
        }
      },
      {
        status: 1,
        submittedPropositions: {
          $elemMatch: { author: user._id }
        }
      }
    );

    if (process.env.DISABLE_SUBJECTS_PROPOSALS_LIMITS) {
      logInfo("hasSubmittedProposition: subjects/propositions limits are disabled by configuration");
      logInfo("Whe should have returned: ", result.length > 0);

      return false;
    }

    return result.length > 0;
  }

  /**
   * Get the maximum voters number over the 5 last decisions
   * @returns {number} max number of voters
   */
  async maxVotersRecentDecisions() {
    // Get 5 latest decisions with "DECIDED" or "VOTE_GENERAL" status
    const mongoFilter: mongoose.FilterQuery<DecisionDocument> = {
      status: {
        $in: ["DECIDED", "GENERAL_VOTE"]
      }
    };

    const mongoLimit = 5;

    const decisions = await this.decisionModel
      .find(mongoFilter, {
        status: 1,
        generalVoteVotesession: 1,
        decisionDate: 1
      })
      .populate<{ generalVoteVotesession: VotingSessionDocument }>("generalVoteVotesession", "votersCount")
      .sort({ decisionDate: -1 })
      .limit(mongoLimit);

    logDebug(decisions);

    let maxVoters = 0;
    for (const i in decisions) {
      maxVoters = Math.max(maxVoters, decisions[i].generalVoteVotesession.votersCount);
    }

    logDebug("Max voters found = ", maxVoters);

    return maxVoters;
  }

  async updateMaxNumberOfVoters() {
    const maxVoters = await this.maxVotersRecentDecisions();

    // Update global
    this.globalsService.setGlobal(GlobalKey.MAX_VOTERS_FIVE_LAST_DECISIONS, maxVoters);
  }

  /**
   * Send app notification when the new featured decision has been selected
   */
  @OnEvent(InternalEventsEnum.DECISION_NEW_DECISION_TO_BE_FEATURED)
  async sendAppNotificationNewDecisionToBeFeatured(payload: { decisionId: string }) {
    cronlogInfo("STARTING JOB: Sending app notification for new decision to be featured");

    // Get decision
    const currentDecision = await this.getDecision(payload.decisionId);
    if (!currentDecision) {
      cronlogError("Current decision not found for decisionId: " + payload.decisionId);
      return; // As this is a possible situation (even rare), do not throw exception
    }

    // Publish annoucement about the new subject
    // TODO: make this translatable
    this.countryModelService.sendMessageToTerritoryChatroom(
      currentDecision.territory._id,
      "Un nouveau sujet a été sélectionné pour la une : `" +
        currentDecision.subject +
        "`: c'est le moment de faire des propositions.",
      {
        gotopageUrl: "/vote/proposition/" + currentDecision._id,
        gotopageLabel: "MESSAGING.GOTOPAGE_LABEL_SELECT_PROPOSITIONS",
        doNotNotify: true // Publish in "announcement" but do not send notification about this
      }
    );
  }

  /**
   * Send app notifications when a new featured decision is available (when a new decision is featured / general vote started)
   * Sent to all users who have not opted out of these notifications
   * @returns void
   */
  @OnEvent(InternalEventsEnum.DECISION_NEW_FEATURED_DECISION)
  async sendAppNotificationNewFeaturedDecision(payload: { decisionId: string }) {
    cronlogInfo("STARTING JOB: Sending app notification for new featured decision (general vote)");

    // Get decision
    const currentDecision = await this.getDecision(payload.decisionId);
    if (!currentDecision) {
      cronlogError("Current decision not found for decisionId: " + payload.decisionId);
      return; // As this is a possible situation (even rare), do not throw exception
    }

    // Check that we did not sent the notification already (check the featuredNotificationSentAt field in DB)
    const decisionFromDb = await this.decisionModel.findById(currentDecision._id, {
      featuredNotificationSentAt: 1
    });
    if (decisionFromDb && decisionFromDb.featuredNotificationSentAt) {
      cronlogError(
        "Featured notification already sent at " +
          decisionFromDb.featuredNotificationSentAt +
          " for decisionId: " +
          payload.decisionId +
          " - skipping notification"
      );
      return;
    }

    // Publish annoucement about the new general vote
    // TODO: make this translatable
    await this.countryModelService.sendMessageToTerritoryChatroom(
      currentDecision.territory._id,
      "`" + currentDecision.subject + "`: c'est le moment de voter pour prendre une décision ensemble !",
      {
        gotopageUrl: "/vote/general/" + currentDecision._id,
        gotopageLabel: "MESSAGING.GOTOPAGE_LABEL_VOTE"
      }
    );

    // Update decision to set featuredNotificationSentAt date
    await this.decisionModel.updateOne(
      { _id: currentDecision._id },
      { $set: { featuredNotificationSentAt: getCurrentDate().getTime() } }
    );

    cronlogInfo("ENDING JOB: Sending app notification for new general vote");
  }

  /********************************************************************************
   *                   VOTING SESSION LIFECYCLE EMAILS
   */

  /**
   * New featured decision email (when a new decision is featured / general vote started)
   * Sent to all users who have not opted out of these emails
   * @returns void
   */
  @OnEvent(InternalEventsEnum.DECISION_NEW_FEATURED_DECISION)
  async sendEmailNewFeaturedDecision(payload: { decisionId: string }) {
    cronlogInfo("STARTING JOB: Sending email for new featured decision (general vote)");

    // Get decision
    const currentDecision = await this.getDecision(payload.decisionId);
    if (!currentDecision) {
      cronlogError("Current decision not found for decisionId: " + payload.decisionId);
      return; // As this is a possible situation (even rare), do not throw exception
    }

    cronlogInfo("Current decision is about : " + currentDecision.subject);

    // Make sure the featuredEmailSentAt field is not already set
    // Note: not returned by getDecision so we need to query the model directly

    const decisionFromDb = await this.decisionModel.findById(currentDecision._id, {
      featuredEmailSentAt: 1
    });
    if (decisionFromDb && decisionFromDb.featuredEmailSentAt) {
      cronlogError(
        "Featured email already sent at " +
          decisionFromDb.featuredEmailSentAt +
          " for decisionId: " +
          payload.decisionId +
          " - skipping email"
      );
      return;
    }

    logDebug("Current decision: ", currentDecision);

    const currentDecisionFeaturedFrom = currentDecision.featuredFrom || getCurrentDate().getTime();

    // Get the latest decision:
    // - featured
    // - on same territory,
    // - with a featuredFrom date before the current decision featuredFrom date
    // - the most recent one
    let latestDecision = await this.decisionModel
      .find(
        {
          territory: new Types.ObjectId(COUNTRY_TERRITORY_ID),
          featuredFrom: { $lt: currentDecisionFeaturedFrom }
        },
        {}
      )
      .sort({ featuredFrom: -1 })
      .limit(1);

    if (latestDecision.length == 0) {
      // No decision found on this territory - try to get the latest decision on the country territory
      cronlogInfo(
        "No latest decision found on territory " +
          currentDecision.territory.name +
          " - looking for latest decision on country territory"
      );
      latestDecision = await this.decisionModel
        .find(
          {
            territory: new Types.ObjectId(COUNTRY_TERRITORY_ID),
            featuredFrom: { $lt: currentDecisionFeaturedFrom }
          },
          {}
        )
        .sort({ featuredFrom: -1 })
        .limit(1);
    }

    cronlogInfo("Latest decision taken: ", latestDecision[0]);

    const mostVotedProposition = latestDecision[0] ? await this.getMostVotedPropositionAtNow(latestDecision[0]) : null;
    logDebug("Most voted proposition of latest decision: ", mostVotedProposition);

    // Build email
    const emailData = {
      vote_subject: currentDecision.subject,
      decision_id: currentDecision._id.toString(),
      last_decision_id: latestDecision[0] ? latestDecision[0]._id.toString() : "XXXXXXXXXXXXX",
      last_week_decision_id: latestDecision[0] ? latestDecision[0]._id.toString() : "XXXXXXXXXXXXX",
      last_week_subject: latestDecision[0] ? latestDecision[0].subject.text : "no subject last week", // Note: no decision should not happend,
      decision_taken: mostVotedProposition ? mostVotedProposition.text : "no decision last week" // Note: no decision should not happend,
    };

    cronlogInfo("Email data: ", emailData);

    // If decision concerns the whole country, send to ALL_USERS constant
    let target: string | string[] = [];
    if (!currentDecision.territory || currentDecision.territory._id.toString() == COUNTRY_TERRITORY_ID) {
      cronlogInfo("Decision concerns the whole country - sending email to ALL_USERS");
      target = ALL_USERS;
    } else {
      cronlogInfo(
        "Decision concerns territory " + currentDecision.territory.name + " - sending email to territory users only"
      );

      // Get emails of users in this territory
      // ie: territory ID is in user's array of territories
      const territoryTypeId = currentDecision.territory.type._id.toString();
      target = await this.userService.getUserEmailsFromFilter({
        [`territories.${territoryTypeId}`]: new Types.ObjectId(currentDecision.territory._id.toString())
      });

      cronlogInfo("Number of target emails: " + target.length);
    }

    // Send email to all users who have not opted out of these emails
    await this.emailService.sendMail({
      dynamicTemplateData: emailData,
      templateId: "new_general_vote",
      to: target
    });

    // Update decision to set featuredEmailSentAt date
    await this.decisionModel.updateOne(
      { _id: currentDecision._id },
      { $set: { featuredEmailSentAt: getCurrentDate().getTime() } }
    );

    cronlogInfo("ENDING JOB: Sending email for new general vote");
  }

  /**
   * Send email reminders to voters who have not voted yet
   */
  async sendEmailVoteReminderVoters() {
    cronlogInfo("STARTING JOB: Sending email reminders to voters");

    // Current decision
    const currentDecision = await this.getCurrentDecision(DecisionStatus.GENERAL_VOTE);
    if (!currentDecision) {
      cronlogError("There is no current active decision in general vote phase");
      return; // As this is a possible situation (even rare), do not throw exception
    }

    cronlogInfo("Current decision: " + currentDecision);

    // If current decision General Vote end (= decisionDate) is more than 48h in the future, skip this email
    // (protection to avoid sending this email for an outdated decision)
    const fortyEightHoursFromNow = Date.now() + 48 * 60 * 60 * 1000;
    if (currentDecision.decisionDate > fortyEightHoursFromNow) {
      cronlogError(
        "Current decision general vote will end " +
          currentDecision.decisionDate +
          " which is not is the next 48h. By security, we dont want to send the email."
      );
      return;
    }

    // Last decision taken
    const latestDecision = await this.findDecisions({ status: DecisionStatus.DECIDED, limit: 1 });
    cronlogInfo("Latest decision taken: " + latestDecision);

    // Build email
    const emailData = {
      vote_subject: currentDecision.subject.text,
      vote_url_params: this.emailService.buildEmailUrlParameter({ decisionId: currentDecision._id }), // End of URL for "vote" button => https://baztille.org/app/vote/vote-general/{{vote_url_params}}
      last_week_subject: latestDecision[0] ? latestDecision[0].subject.text : "no subject last week", // Note: no decision should not happend,
      decision_taken: latestDecision[0] ? latestDecision[0].mostVotedProposition.text : "no decision last week", // Note: no decision should not happend,
      last_decision_results_params: latestDecision[0]
        ? this.emailService.buildEmailUrlParameter({
            decisionId: latestDecision[0]._id.toString(),
            sessionStep: "GENERAL_VOTE",
            notAfterVote: true
          })
        : "XXXXXXXXXXXXX" // Note: no decision should not happend
    };

    cronlogInfo("Email data: ", emailData);

    // Get all users who have not voted yet in this general vote

    if (currentDecision.generalVoteVotesession == null) {
      cronlogError("No general vote voting session found for decision: " + currentDecision._id);
      return;
    }

    const usersToRemind = await this.votingSessionService.getUsersNotVotedYet(currentDecision.generalVoteVotesession);

    cronlogInfo(usersToRemind.length + " Users to remind: ");

    // Extract their emails
    const emailList: string[] = [];
    for (const i in usersToRemind) {
      const email = usersToRemind[i].email;
      if (email) {
        emailList.push(email);
      }
    }

    cronlogDebug(emailList);

    await this.emailService.sendMail({
      dynamicTemplateData: emailData,
      templateId: "did_not_vote_24h_remains",
      to: emailList
    });

    cronlogInfo("ENDING JOB: Sending email for reminder voters");
  }
}
