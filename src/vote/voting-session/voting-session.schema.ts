import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";
import { TerritoryMongo } from "src/countrymodel/schema/territory.schema";
import { DecisionStatus } from "../decision/types/decision-status.enum";
import { VotingSessionChoiceResultDto } from "./voting-session.dto";

export enum VotingSessionAvailability {
  AVAILABLE = "AVAILABLE",
  CLOSED = "CLOSED"
}

/*********************************
 *
 * Voting Session:
 *
 * A voting session is a voting event that takes places from a starting time to an ending time, allowing each citizen in the
 * specified electorate to vote once.
 *
 */

export type VotingSessionDocument = HydratedDocument<VotingSessionMongo>;

@Schema({ collection: "v_voting_session" })
export class VotingSessionMongo {
  _id: string;

  // Voting session type
  @Prop({
    type: String,
    enum: DecisionStatus,
    required: true
  })
  type: DecisionStatus;

  // Voting session starting date (timestamp)
  @Prop({
    type: Number,
    required: true
  })
  startTime: number;

  // Voting session end date (timestamp)
  // Note: can be null, meaning the voting session is open-ended (no ending time)
  @Prop({
    type: Number,
    required: false
  })
  endTime: number | null;

  // Voting session territory: this territory defines the "electorate" (= citizen which have the right to participe to this vote)
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "TerritoryMongo",
    required: true
  })
  territory: string;

  // Voting session root ballot box
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "BallotBoxMongo",
    required: false
  })
  rootBallotBox: string;

  // Sum of the votes for the different options
  // option_id => vote_nbr
  @Prop({
    type: Map,
    of: Number,
    default: {}
  })
  votesSum: Map<string, number>;

  // Total voters counter
  @Prop({
    type: Number,
    default: 0,
    required: true
  })
  votersCount: number;

  // Voting session status
  @Prop({
    type: String,
    enum: VotingSessionAvailability,
    required: true,
    default: VotingSessionAvailability.AVAILABLE
  })
  status: VotingSessionAvailability;

  // Valid voting choices
  @Prop({
    type: [String],
    required: true
  })
  choices: string[];

  // Choices tiebreaker
  // In case of an equality of vote, this determine the final results
  // Choice string => number for the tiebreaker (the higher tiebreaker wins the duel)
  @Prop({
    type: Map,
    of: Number,
    default: {}
  })
  choiceTiebreaker: Map<string, number>;

  // Max choices by vote
  // Ex: if "4", a user can make up to 4 different choices for the vote
  @Prop({
    type: Number,
    required: true,
    default: 1
  })
  maxChoices: number;
}

export const VotingSessionSchema = SchemaFactory.createForClass(VotingSessionMongo);

export type VotingSessionResultSummary = {
  votingSession: VotingSessionDocument;
  votersCount: number;
  results: VotingSessionChoiceResultDto[];
};

// Voting session with populated territory & root ballot box
export interface VotingSessionFull extends Omit<VotingSessionDocument, "territory"> {
  territory: TerritoryMongo;
}
