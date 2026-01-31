import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import * as mongoose from "mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

/*********************************
 *
 * Ballot Box:
 *
 * A Ballot Box is the (virtual) place where the ballot are gathered.
 * A Ballot Box gather all the Ballot from a given territory
 * A Ballot Box must respond to 2 contradictory issues:
 * - it must contains as much Ballots as possible, so that it is impossible to determine citizens choices from the list of voters and
 *   the ballot choices list.
 * - it must not contains too much ballots, because it makes the vote audit (= checks by the citizens themselves) harder, and because
 *   smaller Ballot Box means more local Ballot Box which allow more local decisions.
 * Thus, Ballot Box are *splitted* during a vote (see Ballot Box splitting)
 */

export enum BallotBoxStatus {
  NORMAL = "NORMAL", // Ballot Box regular status
  SPLIT_IN_PROGRESS = "SPLIT_IN_PROGRESS", // A Ballot Box split is in progress: stops any other split for this box
  CREATION_IN_PROGRESS = "CREATION_IN_PROGRESS" // This Ballot Box is receiving ballots from another ballot box right now (do not split for now)
}

export type BallotBoxDocument = HydratedDocument<BallotBoxMongo>;

@Schema({ collection: "v_ballot_box" })
export class BallotBoxMongo {
  _id: string;

  // Voting session this ballot box is part of
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "VotingSessionMongo",
    required: true
  })
  votingSessionId: string;

  // Root territory
  // The Ballot Box initially gather ALL the ballots from the given territory
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "TerritoryMongo",
    required: true
  })
  rootTerritory: string;

  // child ballot box
  // All the territories listed here have now their own Ballot Box (following a Ballot Box "split"),
  // This form a "tree" of Ballot Box, from the root ballot box defined by Voting Session.
  // For these territories, we are not taking anymore ballots as these sub ballot boxes are taking them.
  @Prop({
    type: [MongooseSchema.Types.ObjectId],
    ref: "TerritoryMongo",
    required: false,
    default: []
  })
  childBallotBox: string[];

  // Parent ballot box
  // (opposite of "childBallotBox" before)
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "BallotBoxMongo",
    required: false
  })
  parentBallotBox: string;

  // Number of (actual) votes from the different subdivisions
  // territory_id => number of votes
  // This is used by Ballot Box splitting algorithm to know when to split current Ballot Box
  @Prop({
    type: Map,
    of: Number,
    required: true,
    default: {}
  })
  ballotBySubdivision: Map<string, number>;

  // Total votes count
  @Prop({
    type: Number,
    required: true,
    default: 0
  })
  votesCount: number;

  // Ballot box status
  @Prop({
    type: String,
    enum: BallotBoxStatus,
    required: true,
    default: BallotBoxStatus.NORMAL
  })
  status: string;

  // Ballot Box name
  // Initially, it is based on rootTerritory name
  // After a split, it is updated to a name that reflects the best the remaining territory.
  @Prop({
    type: String,
    required: true,
    trim: true
  })
  name: string;

  // Sum of the votes for the different options
  // (for this ballot box and all child)
  // Note: NOT SET until the voting session is closed
  // option_id => vote_nbr
  @Prop({
    type: Map,
    of: Number,
    default: {}
  })
  votesSum: Map<string, number>;

  // Total voters counter
  // Includes the votes from the child ballot box (this is the difference with "votesCount")
  // Note: NOT SET until the voting session is closed
  @Prop({
    type: Number,
    default: 0,
    required: true
  })
  totalVotesCount: number;
}

export const BallotBoxSchema = SchemaFactory.createForClass(BallotBoxMongo);
BallotBoxSchema.index({ votingSessionId: 1, rootTerritory: 1 }, { unique: true });
