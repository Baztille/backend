import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

import { TextVersionMongo, TextVersionSchema } from "../vote/decision/decision.schema";

/*********************************
 *
 * Debate context:
 *
 * A debate context describes the context of a subject, ie a short text that explains the subject, its vocabulary, its stakes, etc.
 */

export type DebateContextDocument = HydratedDocument<DebateContextMongo>;

/////////////////////////////////////////////
///// Subdocuments schema: Context Proposition

@Schema()
export class ContextPropositionMongo {
  _id: string;

  // Context proposition text
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

  // Votes count
  @Prop({
    type: Number,
    default: 0,
    required: true
  })
  votesCount: number;
}

export const ContextPropositionSchema = SchemaFactory.createForClass(ContextPropositionMongo);

@Schema({ collection: "d_debate_context", timestamps: true })
export class DebateContextMongo {
  _id: string;

  // Decision ID (one context per decision and vice versa)
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "DecisionMongo",
    required: true
  })
  decision: string;

  /// Context selected at now
  // (= context with the most vote + most recent version of this context)
  @Prop({
    type: String
  })
  text: string;

  // ID of the context proposition selected at now
  @Prop({
    type: String
  })
  textId: string;

  // Votes details
  // user ID => context this user ID voted for
  @Prop({
    type: Map,
    of: String,
    default: {}
  })
  votes: Map<string, string>;

  // Debate end date
  // Note: after this date, no one can vote or submit a new context proposition
  @Prop({
    type: Number
  })
  debateEndDate: number;

  /// Subject selection section //////////////////////////
  // (subject_no => subject infos)
  @Prop({
    required: false,
    type: [ContextPropositionSchema],
    default: []
  })
  submittedContext: ContextPropositionMongo[];
}

export const DebateContextSchema = SchemaFactory.createForClass(DebateContextMongo);

/*********************************
 *
 * Debate argument:
 *
 * A debate argument is an argument (or a subargument) that is used to support or oppose a proposition.
 */

export type DebateArgumentDocument = HydratedDocument<DebateArgumentMongo>;

export enum ArgumentType {
  FOR = "FOR", // "For" argument
  AGAINST = "AGAINST" // "Against" argument
}

@Schema({ collection: "d_debate_argument", timestamps: true })
export class DebateArgumentMongo {
  _id: string;

  // Decision ID
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "DecisionMongo",
    required: true
  })
  decision: string;

  // Proposition ID
  // (an argument is always linked to a proposition)
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true
  })
  proposition: string;

  // Parent argument ID
  // undefined if this argument is a first level argument for a proposition
  // otherwise, this is the ID of the parent argument
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: false
  })
  parent?: string;

  /// Title of the argument
  @Prop({
    type: String
  })
  title: string;

  /// Current version of the argument
  // (= most recent version of the argument)
  @Prop({
    type: String
  })
  text: string;

  // Type of the argument (for or against)
  @Prop({
    type: String,
    enum: ArgumentType,
    required: true
  })
  type: string;

  // Author of this submission
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: true
  })
  author: string;

  // History
  // = series of modifications that ended with the current version of the argument
  @Prop({
    type: [TextVersionSchema],
    default: []
  })
  versions: TextVersionMongo[];

  // Votes count
  // = upvotes - downvotes for this argument
  @Prop({
    type: Number,
    default: 0,
    required: true
  })
  votesCount: number;

  // Votes details
  // user ID => +1 if this user upvoted,
  //            -1 if this user downvoted
  @Prop({
    type: Map,
    of: Number,
    default: {}
  })
  votes: Map<string, number>;

  // Reactions list (arguments ID)
  @Prop({
    type: [String],
    default: []
  })
  reactions: string[];
}

export const DebateArgumentSchema = SchemaFactory.createForClass(DebateArgumentMongo);
