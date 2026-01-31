import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import * as argon2 from "argon2";
import { Model } from "mongoose";
import { Role } from "src/common/enum";
import { InternalEventsEnum } from "src/common/enum/internal-events.enum";
import { CountrymodelService } from "src/countrymodel/countrymodel.service";
import { TerritoryMongo } from "src/countrymodel/schema/territory.schema";
import { COUNTRY_TERRITORY_ID, Territory } from "src/countrymodel/types/territory.type";
import { TrackEventType } from "src/event/event-types";
import { EventService } from "src/event/event.service";
import { User } from "src/profile/user/types/user.type";
import { UserMongo } from "src/profile/user/user.schema";
import { StatusService } from "src/status/status.service";
import { getCurrentDate } from "src/utils/date-time";
import { logDebug, logError, logInfo, logWarning } from "src/utils/logger";
import { DecisionStatus } from "../decision/types/decision-status.enum";
import { BallotBoxDocument, BallotBoxMongo, BallotBoxStatus } from "./schema/ballot-box.schema";
import { BallotMongo, BallotRequestMongo } from "./schema/ballot.schema";
import { VoterDocument, VoterMongo } from "./schema/voter.schema";
import {
  BallotDto,
  VotingSessionChoiceResultDto,
  VotingSessionDto,
  VotingSessionResultsDto
} from "./voting-session.dto";
import {
  VotingSessionAvailability,
  VotingSessionDocument,
  VotingSessionFull,
  VotingSessionMongo,
  VotingSessionResultSummary
} from "./voting-session.schema";

@Injectable()
export class VotingSessionService {
  constructor(
    @InjectModel(VotingSessionMongo.name) private readonly votingSessionModel: Model<VotingSessionMongo>,
    @InjectModel(BallotMongo.name) private readonly ballotModel: Model<BallotMongo>,
    @InjectModel(BallotBoxMongo.name) private readonly ballotBoxModel: Model<BallotBoxMongo>,
    @InjectModel(BallotRequestMongo.name) private readonly ballotRequestModel: Model<BallotRequestMongo>,
    @InjectModel(VoterMongo.name) private readonly voterModel: Model<VoterMongo>,
    @InjectModel(UserMongo.name) private readonly userModel: Model<UserMongo>,
    private readonly countryModelService: CountrymodelService,
    private eventEmitter: EventEmitter2,
    private readonly statusService: StatusService,
    private readonly eventService: EventService
  ) {}

  /*
   ** Return Voting session ID
   **/

  /**
   * Create a new Voting Session, on a given territory, for a given period of time
   * @param rootTerritoryId - The territory concerned by the vote
   * @param startTime - starting time for the vote (timestamp)
   * @param endTime - ending time for the vote (timestamp). If null, the vote will be open-ended (no ending time)
   * @returns string ID of the created voting session.
   */
  async createVotingSession(
    rootTerritoryId: string,
    type: DecisionStatus,
    startTime: number,
    endTime: number | null,
    maxChoices: number
  ): Promise<string> {
    const rootTerritory: Territory = await this.countryModelService.getTerritory(rootTerritoryId);

    if (!rootTerritory) {
      throw new Error("createVotingSession: root territory does not exists: " + rootTerritoryId);
    }

    logInfo("Creating a new voting session in " + rootTerritory.name);

    // Validate times
    if (endTime !== null && (startTime >= endTime || endTime <= getCurrentDate().getTime())) {
      throw new Error("Invalid times for voting session: " + startTime + " / " + endTime);
    }

    // Create voting session

    const votingSession = new this.votingSessionModel({
      type: type,
      startTime: startTime,
      endTime: endTime,
      status: VotingSessionAvailability.AVAILABLE,
      territory: rootTerritoryId,
      votesSum: new Map<string, number>(),
      maxChoices: maxChoices
    });

    const createdVotingSesion = await votingSession.save();

    logInfo("New voting session created with ID = " + createdVotingSesion.id);

    // Create first Ballot Box (attached to root territory)

    const rootBallotBox = new this.ballotBoxModel({
      votingSessionId: createdVotingSesion.id,
      rootTerritory: rootTerritoryId,
      name: rootTerritory.name
    });

    const createdBallotBox = await rootBallotBox.save();

    votingSession.rootBallotBox = createdBallotBox._id.toString();
    await votingSession.save();

    return createdVotingSesion.id.toString();
  }

  /**
   * Add possible voting choice to this voting session
   * @param votingSessionId - voting session
   * @param string possible choice for the vote
   * @returns bool true if success
   */
  async addChoice(votingSessionId: string, choice: string, choiceTiebreaker?: number) {
    logInfo("Adding possible choice " + choice + " to voting session " + votingSessionId);

    const votingSession = await this.votingSessionModel.findOne({ _id: votingSessionId });
    if (!votingSession) {
      throw new Error("addChoice: invalid voting session: " + votingSessionId);
    }

    if (votingSession.status != VotingSessionAvailability.AVAILABLE) {
      throw new Error("addChoice: voting session has been closed already");
    }

    if (!choiceTiebreaker) {
      choiceTiebreaker = 0;
    }

    await this.votingSessionModel.updateOne(
      { _id: votingSessionId },
      {
        $push: {
          choices: choice
        },
        ["choiceTiebreaker." + choice]: choiceTiebreaker
      }
    );
  }

  /**
   * Close voting session
   * Note: is supposed to be trigerred at "endTime", but can be trigerred after if needed
   * Close given voting session:
   * - make sure you cannot vote anymore
   * - clean (= destroy) all the data that may be used to des-anonymized the votes
   * - prepare the data for being accessible as results
   * @param votingSessionId - voting session to close
   * @returns bool true if success
   */
  async closeVotingSession(votingSessionId: string): Promise<boolean> {
    const votingSession = await this.getVotingSessionById(votingSessionId);

    if (!votingSession) {
      throw new Error("closeVotingSession: invalid voting session: " + votingSessionId);
    }

    if (votingSession.status != VotingSessionAvailability.AVAILABLE) {
      logError("closeVotingSession: voting session has been closed already");
      return true;
    }

    // Close voting session (= stop all votes now)
    await this.votingSessionModel.updateOne(
      { _id: votingSessionId },
      {
        $set: {
          status: VotingSessionAvailability.CLOSED
        }
      }
    );

    // Destroy "pollingStationId", "nextTerritorySubdivision"  and "securityToken" so we cannot link votes to users in any manner
    await this.ballotModel.updateMany(
      { votingSessionId: votingSessionId },
      {
        $set: {
          pollingStationId: COUNTRY_TERRITORY_ID,
          nextTerritorySubdivision: COUNTRY_TERRITORY_ID,
          securityToken: "**erased**"
        }
      }
    );

    // Remove unused ballots
    await this.ballotModel.deleteMany({ votingSessionId: votingSessionId, used: 0 });

    logInfo("All personal infos removed from voting session");

    // Now, fill the "votesSum" and "votersCount" for every Ballot Box, so we can determine the result of the vote everywhere

    const ballotBoxes = await this.getAllBallotBoxes(votingSessionId);
    const rootBallotBox = ballotBoxes[votingSession.rootBallotBox];
    await this.generateVotesSumData(rootBallotBox, ballotBoxes);

    return false;
  }

  /**
   * For the provided root ballot box, generate "votesSum" and "totalVotesCount" infos
   * (taking account of all child ballot boxes)
   * ... and store them into DB
   * @param rootBallotBox the root ballotBox to analyse
   * @param ballotBoxes all ballot boxes, in an associative array (ID => ballot box)
   * @return ballotBox with the new infos
   */
  private async generateVotesSumData(
    rootBallotBox: BallotBoxDocument,
    ballotBoxes: { [key: string]: BallotBoxDocument }
  ) {
    logInfo("generateVotesSumData for " + rootBallotBox.name);
    //logInfo( rootBallotBox );
    const newRootBallotBox = rootBallotBox;

    // Get ballots in this Ballot Box
    const ballots = await this.ballotModel.find({ ballotBoxId: newRootBallotBox._id, used: true }, { choice: 1 });

    newRootBallotBox.votesCount = ballots.length;
    newRootBallotBox.totalVotesCount = ballots.length;
    newRootBallotBox.votesSum = new Map<string, number>();
    for (const i in ballots) {
      const choices = ballots[i].choice;
      for (const j in choices) {
        const choice = choices[j];

        // Increment +1 this vote
        //logInfo("key: ", choice );
        if (!newRootBallotBox.votesSum.has(choice)) {
          newRootBallotBox.votesSum.set(choice, 0);
        }

        newRootBallotBox.votesSum.set(choice, 1 + (newRootBallotBox.votesSum.get(choice) ?? 0));
      }
    }

    // Now, process childs
    for (const i in rootBallotBox.childBallotBox) {
      const child_id = rootBallotBox.childBallotBox[i];
      let child = ballotBoxes[child_id.toString()];
      if (!child) {
        throw new Error("Cannot find data for child ballot box " + child_id + " from ballot box " + rootBallotBox.name);
      }

      logInfo(" ... processing child " + child.name);

      child = await this.generateVotesSumData(child, ballotBoxes);

      // Update our sums with this subtree
      newRootBallotBox.totalVotesCount += child.totalVotesCount;
      //logInfo("child.votesSum = ", child.votesSum);
      child.votesSum.forEach((vote_count, choice) => {
        //logInfo("key (child): ", choice );

        if (!newRootBallotBox.votesSum.has(choice)) {
          newRootBallotBox.votesSum.set(choice, 0);
        }

        newRootBallotBox.votesSum.set(choice, vote_count + (newRootBallotBox.votesSum.get(choice) ?? 0));
      });
    }

    //logInfo( newRootBallotBox.votesSum );

    // Store in DB
    const newRootBallotBoxDocument = new this.ballotBoxModel(newRootBallotBox);
    await newRootBallotBoxDocument.save();

    return newRootBallotBox;
  }

  /**
   *  Request ballot
   ** Request a ballot for given user, so he/she can vote.
   ** May failed if a ballot has been requested in the latest 12 hours.
   * @param votingSessionId string
   * @param userId string - (only admin can request a ballot for someone else than themselves)
   * @param voterSecret string - a random string generated on client side, unique for each voting session, that must be kept on client side.
   * @returns Returns ballot no and ballot ID.
   */
  async requestBallot(votingSessionId: string, user: User, voterSecret: string): Promise<BallotDto> {
    // Load voting session infos, with detailled infos on root Territory & root Ballot Box
    const votingSession = await this.getVotingSessionById(votingSessionId);

    if (!votingSession) {
      throw new Error("requestBallot: invalid voting session: " + votingSessionId);
    }

    if (votingSession.status != VotingSessionAvailability.AVAILABLE) {
      throw new Error("requestBallot: voting session is not available at now");
    }

    //const rootTerritoryName = votingSession.territory.name;

    //logInfo("Requesting a ballot for a voting session in "+rootTerritoryName );
    //logInfo( votingSession );

    // Check time
    if (
      getCurrentDate().getTime() < votingSession.startTime ||
      (votingSession.endTime !== null && getCurrentDate().getTime() >= votingSession.endTime)
    ) {
      throw new Error("Voting session is not open for voting at this time");
    }

    // Check user level: user must be at least level 1 to vote for subject proposal or propositions selection
    // DEPRECATED: now we authorize all users to vote
    //if (
    //  votingSession.type == DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL ||
    //  votingSession.type == DecisionStatus.SUGGEST_AND_VOTE_SUBJECT
    //) {
    //  if (user.level < 1) {
    //    throw new Error("requestBallot: user level is too low to participate to choice of subjects or proposals");
    //  }
    //}

    // User's polling station and all its territory hierarchy

    if (!user.pollingStationId) {
      throw new Error("requestBallot: polling station not defined for user: " + user._id);
    }

    const pollingStationId = user.pollingStationId._id;

    if (!pollingStationId) {
      throw new Error("requestBallot: cannot find polling station from user: " + pollingStationId);
    }

    const { ballotBox: ballotBox, nextTerritorySubdivision: nextTerritorySubdivision } =
      await this.findBallotBoxForPollingStation(votingSession, pollingStationId);

    // Now that we got our Ballot Box ID, let's find a free ballot_no
    const allBallotNo = await this.ballotModel.find({ ballotBoxId: ballotBox._id }, { no: true });

    const ballot_taken: number[] = [];
    for (const i in allBallotNo) {
      ballot_taken.push(allBallotNo[i].no);
    }

    //logInfo("We found "+allBallotNo.length+" existing ballots in Ballot Box");

    // Max no is:
    // - the number of existing ballot, +1 (to make room for our new ballot)
    // - rounded (top) to a power of ten (1000, 10000, 100000, ...)
    // - with a minimum of 1000
    const max_no = Math.max(1000, Math.pow(10, Math.ceil(Math.log10(allBallotNo.length + 1))));

    // Now let's find a free ballot no...
    let ballot_no: number | null = null;
    const start_no = Math.floor(Math.random() * (max_no + 1));
    for (let inc = 0; inc < max_no; inc++) {
      const ballot_no_candidate = (start_no + inc) % max_no;
      if (ballot_taken.includes(ballot_no_candidate)) {
        // already taken
      } else {
        // We found our candidate!
        ballot_no = ballot_no_candidate;
      }
    }

    if (ballot_no === null) {
      throw new Error("requestBallot: cannot find an available ballot no. Please retry");
    }

    //logInfo( "Ballot no = "+ballot_no );

    // Create security token as hash( owner_provided_hash + ballot_no + userId )
    const securityToken = await argon2.hash(voterSecret + "$" + ballot_no + "$" + user._id);

    // Ballot no validity (between 12 and 24 hours)
    const twelveHours = 12 * 3600 * 1000;
    const validUntil = getCurrentDate().getTime() + twelveHours + Math.random() * twelveHours;

    // Check there is no "Ballot Request" that block creation of new ballot for this user
    const blockBallotRequest = await this.ballotRequestModel.find({
      votingSessionId: votingSessionId,
      userId: user._id,
      blockBallotRequestUntil: { $gt: getCurrentDate().getTime() }
    });

    if (blockBallotRequest.length > 0) {
      logWarning(blockBallotRequest);
      throw new Error(
        "requestBallot: cannot generate a new ballot as you ask for a request ballot recently, please retry later"
      );
    }

    if (ballotBox.status == BallotBoxStatus.SPLIT_IN_PROGRESS) {
      throw new Error("Ballot box splitting is in progress: please retry later");
    }

    // Check that user is not a voter (= did not vote already) + register him/her as voter

    const existingVoter = await this.voterModel.findOne(
      {
        votingSessionId: votingSessionId,
        userId: user._id
      },
      { _id: 1 }
    );

    if (existingVoter) {
      // User already voted before
      throw new Error("You already voted");
    }

    // Create a "Ballot Request" entry to make sure we won't create another ballot in the next hours (between 1 and 12)
    const oneHour = 3600 * 1000;
    const elevenHours = 11 * 3600 * 1000;
    const block_new_request_until = getCurrentDate().getTime() + oneHour + Math.random() * elevenHours;
    const ballotRequest = new this.ballotRequestModel({
      votingSessionId: votingSessionId,
      userId: user._id,
      blockBallotRequestUntil: block_new_request_until
    });
    await ballotRequest.save();

    const ballot = new this.ballotModel({
      votingSessionId: votingSessionId,
      no: ballot_no,
      ballotBoxId: ballotBox._id,
      securityToken: securityToken,
      used: false,
      validUntil: validUntil,
      pollingStationId: pollingStationId,
      nextTerritorySubdivision: nextTerritorySubdivision
    });

    const createdBallot = await ballot.save();

    //logInfo( "New ballot create with ID = " + createdBallot.id );

    return {
      _id: createdBallot._id,
      no: ballot.no,
      used: false,
      validUntil: ballot.validUntil,
      pollingStationId: ballot.pollingStationId,
      ballotBoxId: ballotBox._id,
      votingSessionId: ballot.votingSessionId
    };
  }

  async findBallotBoxForPollingStation(
    votingSession: VotingSessionFull,
    pollingStationId: string
  ): Promise<{ ballotBox: BallotBoxDocument; nextTerritorySubdivision: string }> {
    const rootTerritoryType = votingSession.territory.type.toString();

    // Find route (= chain of territories included in each other) from polling station to root type of territory
    // (ex: if voting session takes place in a "Region", we find the route from polling station to its "Region")
    // Note: we are using for this purpose the "routeTo" data generated in advance and store in DB
    const polling_territory = await this.countryModelService.getTerritory(pollingStationId);

    logDebug("Finding route from polling station " + pollingStationId + " to territory type " + rootTerritoryType);
    logDebug("Polling territory routeTo: " + JSON.stringify(polling_territory.routeTo));
    logDebug(typeof polling_territory.routeTo);
    logDebug(typeof polling_territory.routeTo.get);

    if (!polling_territory.routeTo[rootTerritoryType]) {
      logError(
        "Polling station " +
          pollingStationId +
          " do not have a route to territory type " +
          rootTerritoryType +
          ": did the administrator built the routes for territory type " +
          rootTerritoryType +
          " ?"
      );
      throw new Error(
        "requestBallot: polling station " +
          pollingStationId +
          " do not have a route to territory type " +
          rootTerritoryType
      );
    }

    const routeToRoot = polling_territory.routeTo[rootTerritoryType];

    if (!routeToRoot) {
      throw new Error(
        "requestBallot: polling station " +
          pollingStationId +
          " do not have a route to territory type " +
          rootTerritoryType
      );
    }

    // Check if this root is going to the SAME root element than the current voting session.
    // If it is not, it means that this user is trying to vote in a voting session that does not concern his/her territory
    if (routeToRoot.slice(-1).toString() != (votingSession.territory as any)._id.toString()) {
      logError(routeToRoot.slice(-1), (votingSession.territory as any)._id);
      throw new Error(
        "requestBallot: polling station " +
          pollingStationId +
          " is not linked to root territory of voting session " +
          votingSession._id
      );
    }

    // Now, we must find the first existing Ballot Box on these
    let ballotBox = null;
    let previous_territory = pollingStationId;
    for (const i in routeToRoot) {
      ballotBox = await this.ballotBoxModel.findOne({
        votingSessionId: votingSession._id,
        rootTerritory: routeToRoot[i]
      });
      if (ballotBox) {
        // We found our ballot box!
        break;
      } else {
        previous_territory = routeToRoot[i];
      }
    }

    if (!ballotBox) {
      throw new Error("requestBallot: cannot find the right Ballot Box from polling station " + pollingStationId);
    }

    return {
      ballotBox: ballotBox,
      nextTerritorySubdivision: previous_territory
    };
  }

  /**
   *  Vote
   ** Record users choices on this vote:
   ** - Check that this user have access to this ballot (by generating "securityToken" and comparing to the one in DB)
   ** - If this is a new vote (empty user's choice), check that this user is not already on "Voter's list"
   ** - Record user's choice
   ** - Update Ballot Box voters stats & Voting Session global results
   ** - Trigger a Ballot Box split (asynchronously) if needed
   * @param user string - (only admin can request a ballot for someone else than themselves)
   * @param ballotId string
   * @param voter_secret string - a random string generated on client side, unique for each voting session, that must be kept on client side.
   * @param choices string[] - list of ID of choices of the user (= actual vote)
   * @returns Return true if success
   */
  async vote(
    user: User,
    ballotId: string,
    voterSecret: string,
    choices: string[],
    bModify?: boolean
  ): Promise<boolean> {
    const maintenance = await this.statusService.getMaintenanceStatus();
    if (maintenance && maintenance.canVote === false) {
      throw new Error("There is a maintenance in progress preventing us to vote");
    }
    logInfo(maintenance);

    // Get ballot infos + voting session infos
    const ballot = await this.ballotModel
      .findOne({ _id: ballotId })
      .populate("votingSessionId")
      .populate("ballotBoxId");

    if (!ballot) {
      throw new Error("Vote: cannot find ballot with ID " + ballotId);
    }

    const ballotBoxId = (ballot.ballotBoxId as any)._id;
    const votingSession = ballot.votingSessionId as any;

    //logInfo("Voting session: ", votingSession );

    if (ballot.used) {
      if (bModify) {
        // Ok, this is normal
      } else {
        throw new Error("Vote: ballot has been already used");
      }
    } else {
      if (bModify) {
        throw new Error("Vote: ballot has not been used so it cannot be modified");
      } else {
        // Ok, this is normal
      }
    }

    // Check that this user have access to this ballot using hash
    const securityToken = voterSecret + "$" + ballot.no + "$" + user._id;

    if (ballot.securityToken == "**erased**") {
      throw new Error("Vote: this ballot is no more accessible (vote is probably closed)");
    }

    if (!(await argon2.verify(ballot.securityToken, securityToken))) {
      // User do not have the credential to access this ballot
      logDebug(ballot.securityToken + " // " + securityToken);
      throw new Error("Vote: access denied to this ballot");
    }

    if (votingSession.status != VotingSessionAvailability.AVAILABLE) {
      throw new Error("requestBallot: voting session is not available at now");
    }

    // Check voting session time
    if (
      getCurrentDate().getTime() < votingSession.startTime ||
      (votingSession.endTime && getCurrentDate().getTime() >= votingSession.endTime)
    ) {
      throw new Error("Voting session is not open for voting at this time");
    }

    // Validate user choices
    choices = [...new Set(choices)]; // make choices uniques
    if (choices.length > votingSession.maxChoices) {
      throw new Error("This voting session is limited to a maximum of " + votingSession.maxChoices + " votes");
    }
    for (const i in choices) {
      if (votingSession.choices.includes(choices[i])) {
        // Choice is valid
      } else {
        throw new Error("Choice " + choices[i] + " is not valid for this voting session");
      }
    }

    if (bModify) {
      // Check that user is already a voter
      const voter = await this.voterModel.findOne({
        votingSessionId: votingSession._id,
        userId: user._id
      });

      if (!voter) {
        throw new Error("Want to modify a vote while you are not registered as a voter to this voting session");
      }
    } else {
      // Check that user is not a voter (= did not vote already) + register him/her as voter
      const voter = new this.voterModel({
        votingSessionId: votingSession._id,
        ballotBoxId: ballotBoxId,
        userId: user._id,
        pollingStationId: ballot.pollingStationId,
        nextTerritorySubdivision: ballot.nextTerritorySubdivision
      });

      try {
        await voter.save();
      } catch (err) {
        if (err.code === 11000) {
          // User already voted before
          throw new Error("You already voted");
        }

        throw new Error("Error during voter registration");
      }

      //        logInfo("Voter registered");
    }

    if ((ballot.ballotBoxId as any).status == BallotBoxStatus.SPLIT_IN_PROGRESS) {
      throw new Error("Ballot box splitting is in progress: please retry later");
    }

    // Record choice in the ballot
    await this.ballotModel.updateOne(
      { _id: ballotId },
      {
        $set: {
          choice: choices,
          used: true,
          validUntil: votingSession.endTime
        }
      }
    );

    //        logInfo("Vote recorded");

    if (!bModify) {
      // Track vote
      await this.eventService.trackEvent(TrackEventType.GENERAL_VOTE);

      // Increment voting session partial results

      const increment_table = {
        votersCount: 1
      };
      for (const i in choices) {
        increment_table["votesSum." + choices[i]] = 1;
      }

      await this.votingSessionModel.updateOne(
        { _id: votingSession._id },
        {
          $inc: increment_table
        }
      );

      // Increment ballot box stats
      //        logInfo("Updating ballot box stats");

      const increment_ballot = {
        votesCount: 1
      };
      increment_ballot["ballotBySubdivision." + ballot.nextTerritorySubdivision] = 1;

      await this.ballotBoxModel.updateOne(
        { _id: ballotBoxId },
        {
          $inc: increment_ballot
        }
      );

      // Trigger Ballot Box split if needed
      const ballot_box_aftervote: BallotBoxDocument | null = await this.ballotBoxModel.findOne({ _id: ballotBoxId });

      const split_trigger_limit = (
        process.env.VOTE_BALLOTBOX_SPLIT_LIMIT ? process.env.VOTE_BALLOTBOX_SPLIT_LIMIT : 30
      ) as number;

      if (
        ballot_box_aftervote &&
        (ballot_box_aftervote.ballotBySubdivision.get(ballot.nextTerritorySubdivision.toString()) ?? 0) >=
          split_trigger_limit
      ) {
        if (ballot_box_aftervote.votesCount > 2 * split_trigger_limit) {
          if (ballot_box_aftervote.status == BallotBoxStatus.NORMAL) {
            // Current vote is triggering a Ballot Box split
            await this.splitBallotBox(ballot_box_aftervote, ballot.nextTerritorySubdivision);
          }
        }
      }
    } else {
      // Update votes count, taking into account previous choices

      const increment_table = {};

      // Decrement previous choices
      for (const i in ballot.choice) {
        increment_table["votesSum." + ballot.choice[i]] = -1;
      }
      // Increment new choices
      for (const i in choices) {
        if (increment_table["votesSum." + choices[i]]) {
          increment_table["votesSum." + choices[i]]++;
        } else {
          increment_table["votesSum." + choices[i]] = 1;
        }
      }

      await this.votingSessionModel.updateOne(
        { _id: votingSession._id },
        {
          $inc: increment_table
        }
      );
    }

    // Finally, update user stats for vote (only in case of a new vote)
    if (!bModify) {
      await this.incrementUserVoteStats(user, votingSession);
    }

    // Also update decision stats for vote (only in case of a new vote)
    if (!bModify) {
      this.eventEmitter.emit(InternalEventsEnum.VOTE_NEW_VOTE, { votingSessionId: votingSession._id });
    }

    // Note: we may return a better proof of vote (timestamp, ballot_id, ballot box id)

    return true;
  }

  private async incrementUserVoteStats(user: User, votingSession: VotingSessionDocument) {
    logDebug("incrementUserVoteStats for user " + user._id + " on voting session " + votingSession._id);
    if (votingSession.type) {
      let bCheckForMissions = false;

      if (votingSession.type == DecisionStatus.GENERAL_VOTE) {
        logDebug("User " + user._id + " voted for general vote (updating stat)");

        const updateData = {
          $inc: {
            "activity.votesNbr": 1
          },
          $set: {
            "activity.lastGeneralVoteSessionId": votingSession._id,
            "activity.lastGeneralVoteDate": getCurrentDate().getTime()
          }
        };

        if (!user.activity?.votesNbr || user.activity?.votesNbr == 0) {
          // First vote => trigger missions check
          bCheckForMissions = true;
        }

        // DEPRECATED (vote streaks)
        // Check if user voted for general vote the week before
        // For this, get the previous voting session
        /*const previousVotingSession = await this.votingSessionModel
          .findOne(
            {
              type: DecisionStatus.GENERAL_VOTE,
              endTime: { $lte: votingSession.startTime } // Note: lte is important as each voting session starts exactly when the previous ends
            },
            {
              _id: 1
            }
          )
          .sort({ endTime: -1 });
          

        logDebug("Previous voting session: ", previousVotingSession);
        if (
          previousVotingSession &&
          user.activity?.lastGeneralVoteSessionId &&
          user.activity?.lastGeneralVoteSessionId.toString() == previousVotingSession._id.toString()
        ) {
          // User voted for the latest general vote => this is a "vote streak" => increment it
          logDebug("User " + user._id + " is in a vote streak");
          updateData.$inc["activity.votesStreak"] = 1;
          bCheckForMissions = true;
        } else {
          // Reset vote streak to 1
          updateData.$set["activity.votesStreak"] = 1;
        }*/

        // Increment user activity stat
        await this.userModel.updateOne({ _id: user._id }, updateData);

        // If user has a mentor, we should also update the mentor's recruits list
        if (user.mentor) {
          const updateMentorData = {};
          updateMentorData["recruits." + user._id + ".lastVoteTime"] = getCurrentDate().getTime();
          logDebug("User " + user._id + " has a mentor: " + user.mentor + ", updating mentor's recruits list");
          await this.userModel.updateOne(
            { _id: user.mentor },
            {
              $set: updateMentorData
            }
          );

          // Check if mentor has a mission to check
          this.eventEmitter.emit(InternalEventsEnum.USER_CHECK_MISSIONS_FOR_USER, { userId: user.mentor });
        }
      } else if (votingSession.type == DecisionStatus.SUGGEST_AND_VOTE_SUBJECT) {
        // DEPRECATED: this phase do not exists anymore, and votesNextSubject has been recycled to count the number of new subjects submitted
        /*
        // Increment user activity stat
        logDebug("User " + user._id + " voted for subject suggestion (updating stat)");
        await this.userModel.updateOne(
          { _id: user._id },
          {
            $inc: {
              "activity.votesNextSubject_nbr": 1
            }
          }
        );

        if (!user.activity || !user.activity.votesNextSubject_nbr || user.activity.votesNextSubject_nbr == 0) {
          // First vote => trigger missions check
          bCheckForMissions = true;
        }
        */
      } else if (votingSession.type == DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL) {
        // DEPRECATED: votesNextPropositions has been recycled to count the number of new propositions submitted
        /*
        // Increment user activity stat
        logDebug("User " + user._id + " voted for next propositions (updating stat)");
        await this.userModel.updateOne(
          { _id: user._id },
          {
            $inc: {
              "activity.votesNextPropositions_nbr": 1
            }
          }
        );

        if (
          !user.activity ||
          !user.activity.votesNextPropositions_nbr ||
          user.activity.votesNextPropositions_nbr == 0
        ) {
          // First vote => trigger missions check
          bCheckForMissions = true;
        }*/
      }

      if (bCheckForMissions) {
        this.eventEmitter.emit(InternalEventsEnum.USER_CHECK_MISSIONS_FOR_USER, { userId: user._id });
      }
    }
  }

  /**
   *  Reset a whole voting session votes (= keep it open but remove all votes)
   ** SHOULD BE USED FOR TEST PURPOSE ONLY
   * @param votingSessionId string
   * @return true
   */
  async resetVote(votingSessionId: string) {
    logInfo("Resetting voting session " + votingSessionId);

    await this.ballotRequestModel.deleteMany({ votingSessionId: votingSessionId });
    await this.ballotModel.deleteMany({ votingSessionId: votingSessionId });
    await this.voterModel.deleteMany({ votingSessionId: votingSessionId });
    await this.votingSessionModel.updateOne(
      { _id: votingSessionId },
      { $set: { votesSum: {}, votersCount: 0, status: VotingSessionAvailability.AVAILABLE } }
    );
    await this.ballotBoxModel.updateOne(
      { votingSessionId: votingSessionId },
      { $set: { ballotBySubdivision: {}, votesCount: 0, childBallotBox: [] } }
    );
    await this.ballotBoxModel.deleteMany({ rootTerritory: { $ne: COUNTRY_TERRITORY_ID } });

    return true;
  }

  /**
   *  Get voting session results summary
   * @param votingSessionId string
   * @return voting session summary results
   */
  async getVotingSessionResultsSummary(votingSessionId: string): Promise<VotingSessionResultSummary> {
    //logDebug("Get (summary) results about voting session " + votingSessionId);

    // Get voting session generic infos
    const votingSession: VotingSessionDocument | null = await this.votingSessionModel.findOne({ _id: votingSessionId });

    // Build results array
    const results: VotingSessionChoiceResultDto[] = [];

    if (!votingSession || votingSession === null) {
      throw new Error("Voting session not found: " + votingSessionId);
    }

    votingSession.votesSum.forEach((votes, choice) => {
      results.push({
        choice: choice,
        votes: votes,
        tiebreaker: (votingSession as VotingSessionDocument).choiceTiebreaker.get(choice) ?? 0
      });
    });

    results.sort((a, b) => {
      if (b.votes == a.votes) {
        return b.tiebreaker - a.tiebreaker;
      } else {
        return b.votes - a.votes;
      }
    });

    return {
      votingSession: votingSession,
      votersCount: votingSession.votersCount,
      results: results
    };
  }

  /**
   *  Get voting session infos & results
   ** ... including partial results if vote is in progress
   ** The goal of this method is to give a summary of the results
   * @param votingSessionId string
   * @return voting session full results
   */
  async getVotingSession(votingSessionId: string): Promise<VotingSessionResultsDto> {
    logDebug("Display infos about voting session " + votingSessionId);

    // Get voting session generic infos
    const votingSession = await this.votingSessionModel.findOne({ _id: votingSessionId });

    if (!votingSession) {
      throw new Error("Voting session not found: " + votingSessionId);
    }

    // Get all ballot boxes
    const ballotBoxes = await this.getAllBallotBoxes(votingSessionId);

    // Build ballot boxes tree
    let ballotBoxesTree = ballotBoxes[votingSession.rootBallotBox];
    ballotBoxesTree = this.buildBallotBoxesTree(ballotBoxesTree, ballotBoxes);

    // Perform a mapping to transform votingSession into type VotingSessionDto
    const votingSessionDto: VotingSessionDto = new VotingSessionDto();
    votingSessionDto._id = votingSession._id;
    votingSessionDto.type = votingSession.type;
    votingSessionDto.territory = votingSession.territory;
    votingSessionDto.startTime = votingSession.startTime;
    votingSessionDto.endTime = votingSession.endTime;
    votingSessionDto.choices = votingSession.choices;
    votingSessionDto.maxChoices = votingSession.maxChoices;
    votingSessionDto.status = votingSession.status;
    votingSessionDto.votesSum = votingSession.votesSum;
    votingSessionDto.votersCount = votingSession.votersCount;
    votingSessionDto.choiceTiebreaker = votingSession.choiceTiebreaker;

    return {
      votingSession: votingSessionDto,
      ballotBoxesTree: ballotBoxesTree
    };
  }

  /**
   *  For the provided root ballot box, replace each "childBallotBox" item by the corresponding
   * ballot boxes object
   * @param rootBallotBox the root ballotBox to analyse
   * @param ballotBoxes all ballot boxes, in an associative array (ID => ballot box)
   * @return rootBallotBox with expanded "childBallotBox"
   */
  private buildBallotBoxesTree(rootBallotBox, ballotBoxes) {
    //logInfo( "buildBallotBoxTree for "+rootBallotBox.name );
    //logInfo( rootBallotBox );
    const result = JSON.parse(JSON.stringify(rootBallotBox)); // Clone object
    result.child = {};

    for (const i in rootBallotBox.childBallotBox) {
      // Expand child
      const child_id = rootBallotBox.childBallotBox[i];
      const child = ballotBoxes[child_id.toString()];
      if (!child) {
        throw new Error("Cannot find data for child ballot box " + child_id + " from ballot box " + rootBallotBox.name);
      }
      result.child[i] = this.buildBallotBoxesTree(child, ballotBoxes);
    }
    return result;
  }

  /**
   * Get voting session detailled results (for current user Ballot Box only)
   * The goal of this method is to provide all the possible public data about the vote, so it can be audited by citizens.
   * list of ballots with choices + list of voters.
   ** NOT ALLOWED if vote is still in progress.
   * @param votingSessionId string
   * @return voting session auditable data
   */
  async getVotingSessionAuditableData(votingSessionId: string, user: User) {
    // Get voting session generic infos
    const votingSession = await this.getVotingSessionById(votingSessionId);

    if (!votingSession) {
      throw new Error("Voting session not found: " + votingSessionId);
    }
    if (votingSession.status != VotingSessionAvailability.CLOSED) {
      throw new Error(
        "Voting session is not closed yet: you will be able to access audit data as soon as vote is closed"
      );
    }

    const pollingStationId = (user.pollingStationId as any)._id;

    // Get ballot box associated to this user ID
    const { ballotBox: ballotBox } = await this.findBallotBoxForPollingStation(votingSession, pollingStationId);

    // Get all ballots, sorted by no
    logDebug("Get ballots");
    const ballots = await this.ballotModel
      .find(
        { ballotBoxId: ballotBox._id, used: 1 },
        {
          no: 1,
          choice: 1
        }
      )
      .sort({ no: 1 });

    // Get all voters, sorted by email
    // TODO: change email to name, and sort by name
    logDebug("Get voters");
    let voters = await this.voterModel
      .find(
        { ballotBoxId: ballotBox._id },
        {
          userId: 1
        }
      )
      .populate({
        path: "userId",
        select: "firstName lastName"
      });

    // Sort voters by last name (then first name)
    voters = voters.sort((a, b) => {
      let nameA: string = (a.userId as any)?.lastName + (a.userId as any)?.firstName;
      let nameB: string = (b.userId as any)?.lastName + (b.userId as any)?.firstName;
      if (!nameA) {
        nameA = "";
      }
      if (!nameB) {
        nameB = "";
      }
      return nameA.localeCompare(nameB);
    });

    logDebug(voters);

    return {
      votingSession: votingSession,
      ballotBox: ballotBox,
      ballots: ballots,
      voters: voters
    };
  }

  /**
   * Get the list of users who have not voted yet in the given voting session.
   * @param votingSessionId string
   * @return array of users
   */
  async getUsersNotVotedYet(votingSessionId: string): Promise<{ email: string }[]> {
    const votingSession = await this.getVotingSessionById(votingSessionId);
    if (!votingSession) {
      throw new Error("Voting session not found: " + votingSessionId);
    }

    // Get all voters in this voting session
    const voters = await this.voterModel.find({ votingSessionId: votingSessionId }, { userId: 1 });
    const voterUserIds: string[] = [];
    voters.forEach((voter) => {
      voterUserIds.push(voter.userId);
    });

    logInfo("Voter user IDs: ", voterUserIds);

    // Get emails of all (non removed) users that are NOT in the voterUserIds list:
    // - excluding visitor/unconfirmed emails accounts
    // - keeping user with incomplete profiles (to incite them to complete their profile)
    // - excluding removed accounts
    // - excluding tests accounts (ending with @yopmail.com)
    const usersNotVotedYet: { email: string }[] = await this.userModel.find(
      {
        _id: { $nin: voterUserIds },
        role: { $ne: Role.VISITOR },
        removedAccountDate: { $exists: false },
        email: { $not: /@yopmail\.com$/ }
      },
      {
        email: 1
      }
    );

    //logInfo("Users not voted yet: ", usersNotVotedYet );

    return usersNotVotedYet;
  }

  /**
   * Get the list of votes of the current user for multiple decisions at once
   * @param user User
   * @param votingSessionIds string[]
   * @return array of votes
   */
  async getUserVoteForMultipleDecisions(votingSessionIds: string[], user: User): Promise<string[]> {
    const votes = await this.voterModel.find<VoterDocument>(
      {
        votingSessionId: { $in: votingSessionIds },
        userId: user._id
      },
      {
        _id: 1,
        votingSessionId: 1
      }
    );

    return votes.map((voter) => voter.votingSessionId.toString()); // return only the list of votingSessionId where user voted
  }
  /**
   * Get voting session detailled results (for current user Ballot Box only)
   * in a downloadable file format (CSV)
   * @param votingSessionId string
   * @return voting session auditable data
   */
  async getVotingSessionAuditableDataFile(votingSessionId: string, user: User) {
    return "TODO";
  }

  /**
   * Trigger the split of the given BallotBox, for the given territory subdivison.
   * The split:
   * - create a new BallotBox, child of the current one, associated to the territory subdivision (which is a main subdivision of territory associated with current ballot box)
   * - moves all votes that are located inside the subdivision territory to the new ballot box
   * @param ballotBox BallotBox to split
   * @param subdivisionId string The territory were the new ballot box has been created
   * @return true if we splitted, false otherwise
   */
  async splitBallotBox(ballotBox: BallotBoxDocument, subdivisionId: string) {
    const subdivision = await this.countryModelService.getTerritory(subdivisionId);
    if (!subdivision) {
      throw new Error("splitBallotBox: territory does not exists: " + subdivisionId);
    }

    logInfo("Let's split Ballot Box " + ballotBox.name + " for territory " + subdivision.name);

    // Mark our Ballot Box as "split in progress"
    const updateRes = await this.ballotBoxModel.updateOne(
      { _id: ballotBox._id, status: BallotBoxStatus.NORMAL },
      { $set: { status: BallotBoxStatus.SPLIT_IN_PROGRESS } }
    );
    if (updateRes.modifiedCount == 0) {
      logWarning("This ballot box is already being splitted in some way: stop here");
      return false;
    }

    // Insert the new Ballot Box

    const newBallotBox = new this.ballotBoxModel({
      votingSessionId: ballotBox.votingSessionId,
      rootTerritory: subdivisionId,
      name: subdivision.name,
      status: BallotBoxStatus.CREATION_IN_PROGRESS
    });

    let newBallotBoxId;

    try {
      const newBallotBoxRes = await newBallotBox.save();
      newBallotBoxId = newBallotBoxRes._id;
    } catch (err) {
      if (err.code === 11000) {
        logWarning("This ballot box is already being splitted in some way: stop here");
        return false;
      } else {
        throw new Error("Error during new ballot box insertion");
      }
    }

    // Note: from this point, the new votes on the subdivision territory are redirected to the new ballot box

    // Add new ballot box as child of the previous one
    await this.ballotBoxModel.updateOne(
      { _id: ballotBox._id },
      {
        $push: {
          childBallotBox: newBallotBoxId
        }
      }
    );

    await this.movingVotesAfterSplit(ballotBox, subdivisionId, newBallotBox);

    // Finish & clean
    await this.ballotBoxModel.updateOne({ _id: ballotBox._id }, { $set: { status: BallotBoxStatus.NORMAL } });
    await this.ballotBoxModel.updateOne({ _id: newBallotBoxId }, { $set: { status: BallotBoxStatus.NORMAL } });

    // Then, after all of that, perform a final "moving votes" to make sure that we did not miss a vote that took place while we
    // were splitting the box
    await this.movingVotesAfterSplit(ballotBox, subdivisionId, newBallotBox);

    logInfo("End of split from " + ballotBox.name + " to " + subdivision.name);

    return true;
  }

  /**
   * Move vote to the newly splitted BallotBox (after a split)
   ** Move voters (by updating ballotBoxId & nextTerritorySubdivision)
   ** Move ballot (by updating ballotBoxId & nextTerritorySubdivision)
   ** Update ballot boxes counters accordingly (ballotBySubdivision & votesCount)
   ** (No need to update voting session counters (as votes are "transferred"))
   * @param ballotBox BallotBox to split
   * @param subdivisionId string The territory were the new ballot box has been created
   * @param newBallotBoxId BallotBox The ID of the newly created Ballot Box
   * @return true if we splitted, false otherwise
   */
  async movingVotesAfterSplit(ballotBox: BallotBoxDocument, subdivisionId: string, newBallotBoxId: BallotBoxDocument) {
    ////// Moving votes from the parent Ballot Box to the child, one by one:

    const votingSession = await this.getVotingSessionById(ballotBox.votingSessionId);

    logInfo(ballotBox);
    logInfo(votingSession);

    const rootTerritoryType = votingSession.territory.type;

    // Get all votes with this subdiv

    const voters = await this.voterModel.find({
      ballotBoxId: ballotBox._id,
      nextTerritorySubdivision: subdivisionId
    });
    const ballots = await this.ballotModel.find({
      ballotBoxId: ballotBox._id,
      nextTerritorySubdivision: subdivisionId
    });

    logInfo("Moving " + voters.length + " voters and " + ballots.length + " ballots from ballot box " + ballotBox.name);

    // Get all polling stations
    // Note: we create polling stations list from "ballots" because there are mode (unused) ballots
    let polling_stations_list: string[] = [];
    for (const i in ballots) {
      polling_stations_list.push(ballots[i].pollingStationId);
    }
    polling_stations_list = [...new Set(polling_stations_list)]; // Note: make it unique
    logInfo("Votes are coming from " + polling_stations_list.length + " unique polling stations");
    const polling_stations_territories = await this.countryModelService.getTerritories(polling_stations_list);

    // For each polling stations, get the territory just before our subdivision, and associate each polling station to one of these
    logInfo("Building polling stations => territories array");
    const polling_stations_to_next_subdiv = {};
    for (const i in polling_stations_territories) {
      const pollingStationId = polling_stations_territories[i]._id;
      //logInfo("... processing polling station "+pollingStationId);
      let next_subdiv_for_polling_station: string | null = null;
      let previous_territory = pollingStationId;
      const routeToRootTerritory = polling_stations_territories[i].routeTo[rootTerritoryType.toString()];

      for (const parent_index in routeToRootTerritory) {
        const parent_id = routeToRootTerritory[parent_index];
        //logInfo( " ...... parent id = "+parent_id );

        if (parent_id.toString() == subdivisionId.toString()) {
          // We just reached the route to the new subdiv => previous territory is the new "subdivision" we are looking for this polling station
          //logInfo( "..... found!");
          next_subdiv_for_polling_station = previous_territory;
          break;
        } else {
          // Otherwise, just store this territory ID as it may be the desired result on next loop
          previous_territory = parent_id;
        }
      }

      if (next_subdiv_for_polling_station == null) {
        throw new Error(
          "Could not find next subdivision for polling station " +
            pollingStationId +
            " for subdivision " +
            subdivisionId
        );
      }

      polling_stations_to_next_subdiv[pollingStationId] = next_subdiv_for_polling_station;
    }

    //logInfo( polling_stations_to_next_subdiv );

    // Then update votes (ballots & voters) and update counters
    logInfo("Moving voters... ");
    for (const i in voters) {
      const voter_next_subdiv = polling_stations_to_next_subdiv[voters[i].pollingStationId];
      await this.voterModel.updateOne(
        {
          _id: voters[i]._id
        },
        {
          $set: {
            ballotBoxId: newBallotBoxId._id,
            nextTerritorySubdivision: voter_next_subdiv
          }
        }
      );

      // we must update statistics of current ballot boxes
      // => Update ballot boxes counters (ballotBySubdivision & votesCount)

      const increment_table = {
        votesCount: 1
      };
      increment_table["ballotBySubdivision." + voter_next_subdiv] = 1;
      await this.ballotBoxModel.updateOne(
        { _id: newBallotBoxId._id },
        {
          $inc: increment_table
        }
      );
    }

    // Decrement parent ballot box with voters number (votesCount & ballotBySubdivision)
    const increment_table = {
      votesCount: -1 * voters.length
    };
    increment_table["ballotBySubdivision." + subdivisionId] = -1 * voters.length;
    await this.ballotBoxModel.updateOne(
      { _id: ballotBox._id },
      {
        $inc: increment_table
      }
    );

    logInfo("Moving ballots... ");
    for (const i in ballots) {
      await this.ballotModel.updateOne(
        {
          _id: ballots[i]._id
        },
        {
          $set: {
            ballotBoxId: newBallotBoxId._id,
            nextTerritorySubdivision: polling_stations_to_next_subdiv[ballots[i].pollingStationId]
          }
        }
      );
    }

    logInfo("Finished moving votes!");

    return true;
  }

  /***********************************************
   *  UTILITIES
   */

  async getVotingSessionById(votingSessionId: string): Promise<VotingSessionFull> {
    const votingSession = await this.votingSessionModel
      .findOne({ _id: votingSessionId })
      .populate<{ territory: TerritoryMongo }>("territory");

    if (!votingSession) {
      throw new Error("Voting session not found: " + votingSessionId);
    }

    return votingSession;
  }

  async getAllBallotBoxes(votingSessionId: string): Promise<{ [key: string]: BallotBoxDocument }> {
    const result: { [key: string]: BallotBoxDocument } = {};
    const rawResult = await this.ballotBoxModel.find({ votingSessionId: votingSessionId });

    for (const i in rawResult) {
      result[rawResult[i]._id.toString()] = rawResult[i];
    }
    return result;
  }

  /*
   * Return a list of Ballot Boxes which are part of given territory parents
   * Note: parent exploration stops as soon as the first one has been found
   */
  findBallotBoxesAmongParents(territory_parents, ballotBoxList): string[] {
    let result: string[] = [];

    //logInfo("Exploring ", territory_parents );

    if (ballotBoxList[territory_parents._id]) {
      // Current territory HAS a Ballot Box
      //logInfo("We found a ballot box");
      result.push(territory_parents._id);
    } else {
      for (const i in territory_parents.parents) {
        const partialResult = this.findBallotBoxesAmongParents(territory_parents.parents[i], ballotBoxList);
        result = [...result, ...partialResult];
      }
    }

    return result;
  }
}
