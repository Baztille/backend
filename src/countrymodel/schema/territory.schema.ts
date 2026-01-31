import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";
import { TerritoryRoleEnum } from "../types/territory-role.enum";

export type TerritoryDocument = HydratedDocument<TerritoryMongo>;

/////////////////////////////////////////////
///// Subdocuments schemas

// A territory subdivision
@Schema()
export class TerritorySubdivisionMongo {
  // Reference to the subdivision territory ID
  @Prop({
    type: String,
    required: true,
    ref: "TerritoryMongo"
  })
  subdivisionId: MongooseSchema.Types.ObjectId;

  // true if this subdivision should be considerd as a "main" subdivision.
  // Main subdivisions of a given territory P (= "Parent"):
  // _ are not overalapping each other
  // _ the union of all subdivisions cover completely territory P
  // Main subdivisions are used for virtual voting station splitting algorithm, to split voting station geographically
  // when they reach a certain amount of voters. Main subdivisions, recursively, build a tree that goes from the whole country
  // to each individual voting station.
  @Prop({
    type: Boolean,
    required: true,
    default: true
  })
  mainSubdivision: boolean;
}

export const TerritorySubdivisionSchema = SchemaFactory.createForClass(TerritorySubdivisionMongo);

////////////////////////////////////////////
////// Baztille organisation on a territory

// Role of a user for Baztille on a territory

@Schema()
export class TerritoryRoleMongo {
  _id: string;

  // User ID
  @Prop({
    type: String,
    required: true,
    ref: "User"
  })
  userId: MongooseSchema.Types.ObjectId;

  // Role type
  @Prop({
    type: String,
    enum: TerritoryRoleEnum,
    required: true
  })
  role: TerritoryRoleEnum;

  // Since when the user has this role (timestamp)
  @Prop({
    type: Number,
    required: true
  })
  since: number;

  // Until when the user had this role (timestamp). undefined if still active
  @Prop({
    type: Number,
    required: false
  })
  until?: number;
}

export const TerritoryRoleSchema = SchemaFactory.createForClass(TerritoryRoleMongo);

// An election candidate (or a list of candidates) supported by Baztille on this territory
@Schema()
export class TerritoryElectionCandidateMongo {
  // Name of the candidate or the list name
  @Prop({
    type: String,
    required: true
  })
  name: string;

  // URL associated to this candidate or list (ex: campaign website)
  @Prop({
    type: String,
    required: false
  })
  url?: string;
}

export const TerritoryElectionCandidateSchema = SchemaFactory.createForClass(TerritoryElectionCandidateMongo);

@Schema()
export class TerritoryOrganizationMongo {
  _id: string;

  // ID of the Matrix discussion associated to this territory
  @Prop({
    type: String,
    required: false,
    default: ""
  })
  chatroomId?: string;

  // List of users roles for Baztille on this territory
  @Prop({
    type: [TerritoryRoleSchema],
    default: []
  })
  roles: TerritoryRoleMongo[];

  // Election candidate (if any) supported by Baztille on this territory for the next election
  @Prop({
    type: TerritoryElectionCandidateSchema,
    required: false
  })
  nextElectionCandidate?: TerritoryElectionCandidateMongo;
}

export const TerritoryOrganizationSchema = SchemaFactory.createForClass(TerritoryOrganizationMongo);

////////////////////////////////////////////
////// VotableTerritory schema

// A votable territory is a territory where decisions can be votable
@Schema()
export class VotableTerritoryMongo {
  // Are decisions votable on this territory?
  // Ie: can users create subjects and vote on them on this territory?
  @Prop({
    type: Boolean,
    required: true,
    default: true
  })
  votableDecisions: boolean;

  // Current hotness trigger value for this territory
  // (used to know when to feature a decision for this territory)
  // Note: only defined if votableDecisions = true
  @Prop({
    type: Number,
    required: true,
    default: 10
  })
  currentFeaturedDecisionTrigger: number;

  // Latest featured decision trigger value for this territory
  // = currentFeaturedDecisionTrigger value at the time of the latest featuring
  @Prop({
    type: Number,
    required: false
  })
  latestFeaturedDecisionTrigger?: number;

  // Latest featured decision date on this territory
  // Note: used to define actual hotness trigger as it starts from a base value and decreases over time since latest featuring
  @Prop({
    type: Number,
    required: false
  })
  latestFeaturedDecisionDate?: number;

  // Latest featured decisions hotness trigger on this territory
  // = hotness value of the latest decision that has been featured on this territory at the time of featuring
  // (map of featured decisions timestamp => hotness trigger value at this time)
  @Prop({
    type: Map,
    of: Number,
    required: false,
    default: {}
  })
  latestFeaturedDecisionTriggerHistory?: Map<number, number>;

  // List of decisions linked this territory
  @Prop({
    type: [MongooseSchema.Types.ObjectId],
    required: false,
    default: [],
    ref: "DecisionMongo"
  })
  decisions?: MongooseSchema.Types.ObjectId[];

  // Chat room linked to this territory
  // (where voting events are published)
  @Prop({
    type: String,
    required: false,
    default: ""
  })
  chatroomId?: string;
}

export const VotableTerritorySchema = SchemaFactory.createForClass(VotableTerritoryMongo);

////////////////////////////////////////////
////// Main schema

@Schema({ collection: "c_territory" })
export class TerritoryMongo {
  _id: string;

  // Public name of the territory
  @Prop({
    type: String,
    required: true
  })
  name: string;

  // "Cleaned" Public name of the territory:
  //  - only a-z or 0-9 or space
  //  - accents/special letter are replaced with nearest letter (ex: à => a)
  //  - other characters are replaced with space (ex: ' => space)
  // Note: used for text based search
  @Prop({
    type: String,
    required: true
  })
  cleanname: string;

  // Type of the territory (see "TerritoryTypeMongo")
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: "TerritoryTypeMongo"
  })
  type: MongooseSchema.Types.ObjectId;

  // true if territory is active / false if it is kept only for archived purpose
  @Prop({
    type: Boolean,
    required: true,
    default: true
  })
  active: boolean;

  // Short name of the territory (ex: PACA for "Provence Alpes Côte d'Azur" or "19" for "Corrèze")
  // It should actually MEAN something for the citizens of the country: if this is not well known/well used, this should not be used
  // (and left blank)
  @Prop({
    type: String,
    default: ""
  })
  shortname?: string;

  // Official code. This code is:
  // _ used as a long time stable reference for this territory, making sure that the territory DB object will
  //   remains even if the territory name change.
  // _ is not visible by users
  // _ is not required (but in this case, if the territory's name change, it may create a new entry)
  // _ MUST have an official existence and meaning for the country administration
  // Example: commune "INSEE code" for French cities
  @Prop({
    type: String,
    default: ""
  })
  officialCode?: string;

  // Subdivisions
  // If a territory B is totally included in a territory A, B is a subdivision of A.
  // Note: if a territory C a subdivision of B, and B is a subdivision of A, you must NOT add C as a subdivision of A in the schema.
  @Prop({
    type: [TerritorySubdivisionSchema],
    default: []
  })
  subdivisions: TerritorySubdivisionMongo[];

  // Parents
  // If B is a subdivision of A, A is the parent of B.
  @Prop({
    type: [MongooseSchema.Types.ObjectId],
    default: [],
    ref: "TerritoryMongo"
  })
  parents: MongooseSchema.Types.ObjectId[];

  // Note: only for Polling Station
  // For a type of territory (ex: Region), this array describe the "route" to go from Polling Station to the Parent territory of this type (which
  //  administrate people from the polling station).
  // (ex: for "Region" territory type, array in routeTo['region'] contains list of ID of successive parent territory of the polling station
  //  that ends with the first Region found)
  @Prop({
    required: false,
    type: Map,
    of: [MongooseSchema.Types.ObjectId],
    default: {}
  })
  routeTo: Map<string, [string]>;

  // Number of users registered (= no visitors) in this territory
  @Prop({
    type: Number,
    required: false,
    default: 0
  })
  registeredUsersCount?: number;

  // Baztille organization on this territory
  // Note: undefined if no organization on this territory
  @Prop({
    type: TerritoryOrganizationSchema,
    required: false,
    default: () => ({})
  })
  organization?: TerritoryOrganizationMongo;

  // Are decisions votable on this territory?
  // Ie: can users create subjects and vote on them on this territory?
  // If yes, this VotableTerritory subdocument is set
  @Prop({
    type: VotableTerritorySchema,
    required: false
  })
  votableTerritory?: VotableTerritoryMongo;
}

export const TerritorySchema = SchemaFactory.createForClass(TerritoryMongo);
TerritorySchema.index({ type: 1, cleanname: "text" });
