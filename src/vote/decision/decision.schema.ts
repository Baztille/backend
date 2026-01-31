import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

import { DecisionStatus } from "./types/decision-status.enum";
import { SubjectTheme } from "./types/subject-theme.enum";

/*********************************
 *
 * Decision:
 *
 * A Decision is the whole process of deciding something together for a territory (and its subdivision), in 3 steps
 * (selecting a subject, selecting 4 propositions, vote for the best proposition).
 * Once "decided", the decision document keeps what has been decided and where this decision takes effect.
 *
 */

export type DecisionDocument = HydratedDocument<DecisionMongo>;

/////////////////////////////////////////////
///// Subdocuments schema: TextVersionMongo
// (= version of a text) / used by subjects & propositions

@Schema()
export class TextVersionMongo {
  // Label
  @Prop({
    type: String,
    required: true
  })
  text: string;

  // Author of this version
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true
  })
  author: string;

  // Date of the update (timestamp/ms)
  @Prop({
    type: Number,
    required: true
  })
  creationDate: number;
}

export const TextVersionSchema = SchemaFactory.createForClass(TextVersionMongo);

/////////////////////////////////////////////
///// Subdocuments schema: Subject

@Schema()
export class SubjectMongo {
  @Prop({
    type: MongooseSchema.Types.ObjectId
  })
  _id: string;

  // Subject label
  @Prop({
    type: String,
    required: true
  })
  text: string;

  // Subject theme
  @Prop({
    type: String
  })
  theme: SubjectTheme;

  // Author of this submission
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true
  })
  author: string;

  // Keywords (= tags)
  @Prop({
    type: [String],
    trim: true
  })
  keywords?: [string];

  // History
  // = series of modifications that ended with the current version of the subject
  @Prop({
    type: [TextVersionSchema],
    default: []
  })
  versions: TextVersionMongo[];
}

export const SubjectSchema = SchemaFactory.createForClass(SubjectMongo);

/////////////////////////////////////////////
///// Subdocuments schema: Proposition

@Schema()
export class PropositionMongo {
  _id: string;

  // Proposition label
  @Prop({
    type: String,
    required: true
  })
  text: string;

  // Author of this submission
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true
  })
  author: string;

  // History
  // = series of modifications that ended with the current version of the proposition
  @Prop({
    type: [TextVersionSchema],
    default: []
  })
  versions: TextVersionMongo[];
}

export const PropositionSchema = SchemaFactory.createForClass(PropositionMongo);

/////////////////////////////////////////////////
////// MAIN schema: decision

@Schema({ collection: "d_decision", timestamps: true })
export class DecisionMongo {
  _id: string;

  // Decision status (subject choice / proposition choice / general vote / decided)
  @Prop({
    type: String,
    default: DecisionStatus.SUGGEST_AND_VOTE_SUBJECT
  })
  status: DecisionStatus;

  // Decision root territory: this territory defines the "electorate" (= citizen which have the right to participe to this decision)
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "TerritoryMongo",
    required: true
  })
  territory: string;

  // Decision key dates:
  // - when the decision has been created
  // - when the subject has been selected (or will be...) (DEPRECATED)
  // - when the propositions have been selected (or will be...)
  // - when the decision has been taken (or will be...)
  // Note: all are timestamp / milliseconds
  @Prop({
    type: Number
  })
  creationDate: number;

  @Prop({
    type: Number
  })
  subjectSelectionDate: number; // DEPRECATED: now equals to creationDate

  @Prop({
    type: Number
  })
  propositionsSelectionDate: number;

  @Prop({
    type: Number
  })
  decisionDate: number;

  /// Subject selected for this decision
  // Note: duplicate of same object from "submittedSubjects"
  @Prop({
    type: SubjectSchema
  })
  subject: SubjectMongo;

  /// Subject selection section //////////////////////////
  // DEPRECATED, now subject is directly selected when decision is created
  // (subject_no => subject infos)
  @Prop({
    required: false,
    type: [SubjectSchema],
    default: []
  })
  submittedSubjects: SubjectMongo[]; // DEPRECATED

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "VotingSessionMongo"
  })
  subjectSelectionVotesession: string | null; // DEPRECATED

  /// Propositions (4 max) selected for this decision
  // Note: duplicate of same objects from "submittedPropositions"
  @Prop({
    type: [PropositionSchema],
    default: []
  })
  propositions: PropositionMongo[];

  /// Propositions selection section //////////////////////////
  // (proposition_no => proposition infos)
  @Prop({
    required: false,
    type: [PropositionSchema],
    default: []
  })
  submittedPropositions: PropositionMongo[];

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "VotingSessionMongo"
  })
  propositionsSelectionVotesession: string;

  //// Decision hotness //////////////////////////

  // Defines how much this decision is popular currently (= many votes from the citizens)

  // Hotness score, computed based on recent voting activity
  @Prop({
    type: Number,
    default: 0
  })
  hotnessScore: number;

  // Voting activity (= store number of votes per day)
  // Map day (as timestamp) to number of votes
  @Prop({
    required: false,
    type: Map,
    of: Number,
    default: {}
  })
  votingActivity: Map<string, number>;

  //// Featured section //////////////////////////

  // Featured date start
  // If set, decision is featured starting this date
  @Prop({
    type: Number,
    required: false
  })
  featuredFrom: number;

  // Featured date end
  // If set, decision is featured until this date
  // Note If not set, decision is featured
  @Prop({
    type: Number,
    required: false
  })
  featuredTo: number;

  // Featured email sent at
  // If set, date when we sent the featured decision email
  @Prop({
    type: Number,
    required: false
  })
  featuredEmailSentAt: number;

  // Featured notification sent at
  // If set, date when we sent the featured decision notification
  @Prop({
    type: Number,
    required: false
  })
  featuredNotificationSentAt: number;

  //// Decisions taken section //////////////////////////

  /// Most voted proposition (no => reference to submittedPropositions)
  @Prop({
    type: PropositionMongo
  })
  mostVotedProposition: PropositionMongo;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "VotingSessionMongo"
  })
  generalVoteVotesession: string | null;

  // Which decision has been taken on each territory
  // (territory_id => proposition_id)
  @Prop({
    required: false,
    type: Map,
    of: String,
    default: {}
  })
  territoryToProposition: Map<string, string>;
}

export const DecisionSchema = SchemaFactory.createForClass(DecisionMongo);

// Add indexes
DecisionSchema.index({ propositionsSelectionVotesession: 1 }); // Lookup by voting session
DecisionSchema.index({ generalVoteVotesession: 1 }); // Lookup by voting session
