import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import * as mongoose from "mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

/*********************************
 *
 * Ballot:
 *
 * A Ballot represents the envelop used by citizens to put their (secret) votes inside.
 * A Ballot is attributed to each citizen before each vote, and then the citizen
 * is placing this ballot in a Ballot Box.
 * This data is the only way to make the link between ballot owners (citizens) and their ballot.
 * For confidentiality reasons, this data is removed as soon as the vote has ended, so that link between
 * citizens and ballot is broken irrevocally.
 */

export type BallotDocument = HydratedDocument<BallotMongo>;

@Schema({ collection: "v_ballot" })
export class BallotMongo {
  _id: string;

  // Voting session this ballot is part of
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "VotingSessionMongo",
    required: true
  })
  votingSessionId: string;

  // Ballot no = public ID of the ballot from the user point of view
  //     Note: there must be at most 1 ballot with a given "no" in a given ballot box
  // We try to make ballot no as small as possible (<1000 if possible, otherwise <10k)
  @Prop({
    type: Number,
    required: true
  })
  no: number;

  // Ballot box where the ballot is (or is going to be)
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "BallotBoxMongo",
    required: true
  })
  ballotBoxId: string;

  // Security token so that the ballot owner can prove that he/she is the legitimate owner of the ballot
  // We are storing here hash( owner_provided_hash + ballot_no + userId )
  @Prop({
    type: String,
    required: true,
    trim: true
  })
  securityToken: string;

  // Choice made by the user (= actual vote)
  // If not defined => the user has not voted yet
  @Prop({
    type: [String],
    required: false
  })
  choice?: string[];

  // Choice made by the user (= actual vote)
  // If not defined => the user has not voted yet
  @Prop({
    type: Boolean,
    required: true,
    default: false
  })
  used: boolean;

  // Validity timestamp:
  // - before being used (=not placed yet inside ballot box), ballot is valid a random time between 12 and 24 hours.
  //   After that it may be garbage collected so that the "no" can be reused.
  // - after being used (= placed inside ballot box), ballot is valid until the end of the vote, and must be removed
  //   at the end of the vote to cut the latest link between a user and its ballot.
  @Prop({
    type: Number,
    required: true
  })
  validUntil: number;

  // Polling station:
  // This is voting user most deeper territory.
  // This geographical reference is used when we are splitting the Ballot Boxes depending on territories (see Ballot Box Splitting)
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "TerritoryMongo"
  })
  pollingStationId: string;

  // Next territory subdivision
  // This territory is:
  // - a main subdivision of this vote's Ballot Box territory
  // - a parent of user's polling station
  // Thus, this territory is a potential Ballot Box Splitting candidate if we got enough votes in it.
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "TerritoryMongo"
  })
  nextTerritorySubdivision: string;
}

export const BallotSchema = SchemaFactory.createForClass(BallotMongo);
BallotSchema.index({ ballotBoxId: 1, no: 1 }, { unique: true });

/*********************************
 *
 * Ballot Request
 *
 * We are using this collection to store ballot request from citizens, in order to avoid an attack that would try to
 * request as many ballots as possible from the system without voting afterwards, trying to saturate the Ballot collection
 * and generating super high Ballot numbers.
 * Using this collection, we limit the number of generated ballot during a random time (between 1 and 12 hour) per user / per voting session.
 * Note: by limiting this random time to 12 hours, we make sure that if your ballot expires with the minimum time (12 hours) you are
 *       100% sure to be able to request a new one.
 * Note: this feature does NOT prevent a user to vote several time: this is is the role of "Voters" table instead. It is only there
 *       to prevent Ballot collection saturation.
 * Note: As Ballot validity duration is generated randomly, this is not possible to make a link between a Ballot Request and a specific
 *       Ballot using timestamps, which would break vote confidentiality.
 *
 */
export type BallotRequestDocument = HydratedDocument<BallotRequestMongo>;

@Schema({ collection: "v_ballot_request" })
export class BallotRequestMongo {
  // Voting session this ballot request is part of
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "VotingSessionMongo",
    required: true
  })
  votingSessionId: string;

  // User that requested a ballot
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: "User"
  })
  userId: string;

  // Timestamp of the latest generated ballot
  @Prop({
    type: Number,
    required: true
  })
  blockBallotRequestUntil: number;
}

export const BallotRequestSchema = SchemaFactory.createForClass(BallotRequestMongo);
