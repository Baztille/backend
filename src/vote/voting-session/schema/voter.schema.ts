import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import * as mongoose from "mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

/*********************************
 *
 * Voter
 *
 * This is the voter's registration record, ie the list of who voted for each Ballot Box.
 * The role of these records are:
 * - to make sure each citizen vote once and only once.
 * - to make it public after vote (for audit purpose) the list of voters, in order to check there is no fraud
 */

export type VoterDocument = HydratedDocument<VoterMongo>;

@Schema({ collection: "v_voter" })
export class VoterMongo {
  // Voting session this voter is part of
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "VotingSessionMongo",
    required: true
  })
  votingSessionId: string;

  // Ballot box where this voter's ballot is
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "BallotBoxMongo",
    required: true
  })
  ballotBoxId: string;

  // Our user
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true
  })
  userId: string;

  // Polling station:
  // This is voting user most deeper territory.
  // This geographical reference is used when we are splitting the Ballot Boxes depending on territories (see Ballot Box Splitting),
  //  to move the voter to the new voter registration record (for the new Ballot Box)
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "TerritoryMongo"
  })
  pollingStationId: string;

  // Next territory subdivision
  // This territory is:
  // - a main subdivision of this vote's current Ballot Box territory
  // - a parent of voters's polling station
  // Thus, if there is a Ballot Box split, we know where to move our voter
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "TerritoryMongo"
  })
  nextTerritorySubdivision: string;
}

export const VoterSchema = SchemaFactory.createForClass(VoterMongo);
VoterSchema.index({ votingSessionId: 1, userId: 1 }, { unique: true });
