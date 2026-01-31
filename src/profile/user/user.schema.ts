import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";
import { Role } from "src/common/enum";
import { UserDiscoverStep } from "src/profile/user/types/user-discover-step.enum";

export type UserDocument = HydratedDocument<UserMongo>;

export type SocialNetworkType = "facebook" | "linkedin" | "instagram" | "bluesky" | "discord";
export type AppStoreType = "ios" | "android";

// User's device
@Schema()
export class UserDeviceMongo {
  @Prop({
    type: String,
    required: true
  })
  brand: string;

  @Prop({
    type: String,
    required: true
  })
  model: string;

  // Device Unique ID (generated on first use)
  @Prop({
    type: String,
    required: true
  })
  uuid: string;

  // Push notification token
  @Prop({
    type: String,
    required: false
  })
  notifToken: string;

  // Last session
  @Prop({
    type: Number,
    required: false
  })
  lastSession: number;
}

export const UserDeviceSchema = SchemaFactory.createForClass(UserDeviceMongo);

// Email optin/optout
@Schema()
export class UserEmailOptionMongo {
  @Prop({
    type: Boolean,
    required: true
  })
  option: boolean;

  // Choice date
  @Prop({
    type: Number,
    required: false
  })
  date: number;
}

export const UserEmailOptionSchema = SchemaFactory.createForClass(UserEmailOptionMongo);

// Completed missions
@Schema()
export class UserMissionCompletedMongo {
  // Mission slug
  @Prop({
    type: String,
    required: true
  })
  slug: string;

  // Has mission been collected?
  @Prop({
    type: Boolean,
    required: true,
    default: false
  })
  collected: boolean;

  // Mission completion date
  @Prop({
    type: Number,
    required: false
  })
  completionDate: number;

  // Mission collection date
  @Prop({
    type: Number,
    required: false
  })
  collectionDate: number;
}

export const UserMissionCompletedSchema = SchemaFactory.createForClass(UserMissionCompletedMongo);

// User activity
@Schema()
export class UserActivityMongo {
  // Date of the last general vote
  // (Note: used to know if user is active)
  @Prop({
    type: Number,
    required: false,
    default: 0
  })
  lastGeneralVoteDate: number;

  // ID of the last general vote session this user has participated to
  @Prop({
    type: String,
    required: false,
    default: ""
  })
  lastGeneralVoteSessionId: string;

  // Number of votes
  @Prop({
    type: Number,
    required: false,
    default: 0
  })
  votesNbr: number;

  // Number of votes streak size
  // (ie: number of consecutive votes for the General votes)
  // DEPRECATED / kept for historical reasons
  @Prop({
    type: Number,
    required: false,
    default: 0
  })
  votesStreak: number;

  // Number of new subjects submitted
  @Prop({
    type: Number,
    required: false,
    default: 0
  })
  votesNextSubject_nbr: number;

  // Number of new propositions submitted
  @Prop({
    type: Number,
    required: false,
    default: 0
  })
  votesNextPropositions_nbr: number;
}

export const UserActivitySchema = SchemaFactory.createForClass(UserActivityMongo);

// Recruit
@Schema()
export class RecruitActivityMongo {
  @Prop({
    type: Number,
    required: false,
    default: 0
  })
  lastVoteTime: number; // timestamp of the last activity (general vote) of this recruit

  @Prop({
    type: Number,
    required: false,
    default: 0
  })
  level: number; // current level of this recruit
}

export const RecruitActivitySchema = SchemaFactory.createForClass(RecruitActivityMongo);

export type UserKey = string;

////////////////////////////////////////////
////// Main schema

@Schema({ collection: "u_user", timestamps: true })
export class UserMongo {
  _id: string;

  @Prop({
    type: String,
    unique: true,
    trim: true,
    index: true
  })
  key: UserKey; // A visual way to identify a user, based on normalized email.
  // eg: for email "john.doe+baztille@acme.com", key will be "john.doe#acmecom"

  @Prop({
    type: String,
    unique: true,
    trim: true
  })
  email: string; // Original email (before normalization) => used when sending or displaying email to user
  // Note: not indexed: please transform to key + search by "key" instead

  @Prop({
    type: [
      {
        code: String,
        time: Number
      }
    ],
    default: []
  })
  emailValidationCode: string[];

  // Number of email validation attempts that leads to an error (note: after 3 attempts, user should request another code)
  @Prop({
    type: Number,
    trim: true,
    default: 0,
    required: false
  })
  emailValidationErrorAttempts?: number;

  @Prop({
    type: String,
    required: false,
    unique: true,
    sparse: true, // see https://stackoverflow.com/questions/7955040/mongodb-mongoose-unique-if-not-null
    trim: true
  })
  emailToBeValidated?: string; // Note: email not yet validated by user

  @Prop({
    type: String,
    trim: true,
    required: false
  })
  firstName?: string;

  @Prop({
    type: String,
    trim: true,
    required: false
  })
  lastName?: string;

  @Prop({
    type: Number,
    trim: true,
    required: false
  })
  birthDate?: number;

  @Prop({
    type: String,
    trim: true,
    sparse: true, // see https://stackoverflow.com/questions/7955040/mongodb-mongoose-unique-if-not-null
    unique: true,
    required: false,
    index: true
  })
  phoneNumber?: string; // Note: stored in E.164 format (eg: +33612345678)

  @Prop({
    type: String,
    trim: true,
    required: false
  })
  phoneNumberToBeValidated?: string; // Note: phone number not yet validated by user

  // Account since
  @Prop({
    type: Number,
    required: true
  })
  creationDate: number;

  // Member since
  @Prop({
    type: Number,
    required: false
  })
  memberSince?: number;

  // Last session
  @Prop({
    type: Number,
    required: true
  })
  lastSession: number;

  // Removed account date (= timestamp of the account removal request, if any)
  @Prop({
    type: Number,
    required: false
  })
  removedAccountDate?: number;

  @Prop({
    type: String,
    trim: true,
    default: Role.VISITOR,
    required: true
  })
  role: Role;

  @Prop({
    type: String,
    trim: true,
    default: UserDiscoverStep.NOT_CONVINCED,
    required: true
  })
  discoverStep: UserDiscoverStep;

  // Note: Public Name is how you appear for other users
  @Prop({
    type: String,
    trim: true,
    required: false // Note: not required if role = USER_INCOMPLETE
  })
  publicName?: string;

  @Prop({
    type: MongooseSchema.Types.Mixed,
    required: false
  })
  address?: string;

  @Prop({
    type: String,
    required: false,
    trim: true
  })
  avatar?: string; // Avatar ID (used to display avatar using avataaars library)

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: false, // Note: not required if role = USER_INCOMPLETE
    ref: "TerritoryMongo"
  })
  pollingStationId?: string;

  @Prop({
    type: Boolean,
    required: false
  })
  pollingStationUncertain?: boolean; // If true, the polling station ID is uncertain (user did not remember his polling station) and should be ask again when it will be really useful

  // Polling station history
  // (used to make sure citizens don't change too often their polling station)
  @Prop({
    type: [
      {
        pollingStationId: String,
        until: Number
      }
    ],
    default: []
  })
  pollingStationHistory: {
    pollingStationId: string;
    until: number; // timestamp until which this polling station was valid
  }[];

  // List of territories (IDs) where user is linked to (for elected representatives, etc.), by territory type
  @Prop({
    type: Map,
    of: MongooseSchema.Types.ObjectId,
    default: {}
  })
  territories: Map<MongooseSchema.Types.ObjectId, MongooseSchema.Types.ObjectId>; // territory type => territory ID

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: false
  })
  invitedBy?: string;

  @Prop({
    type: String,
    default: "",
    required: false
  })
  matrixSecret?: string;

  // User "My notifications" chatroom ID on Matrix server
  // My notifications chatroom is used to send notifications to user inside the app
  @Prop({
    type: String,
    default: "",
    required: false
  })
  myNotificationsChatroom?: string;

  // User's device lists
  @Prop({
    type: Map,
    of: UserDeviceSchema,
    required: true,
    default: {}
  })
  devices: Map<string, UserDeviceMongo>;

  // User's device lists
  @Prop({
    type: Map,
    of: UserEmailOptionSchema,
    required: true,
    default: {}
  })
  emailsPrefs: Map<string, UserEmailOptionMongo>;

  // Sendgrid account created
  @Prop({
    type: Number,
    required: false
  })
  sendgridInfosCreationDate?: number;

  // User activity
  // (ie: number of votes, number of votes streak size, etc.)
  @Prop({
    type: UserActivityMongo,
    required: false
  })
  activity: UserActivityMongo;

  // Social networks joined by user
  // (note: we cannot know for sure if user is really registered on this social network, so we just store the fact that user has clicked on the button)
  // Available social networks codes:
  // - facebook
  // - linkedin
  // - instagram
  // - bluesky
  // - discord
  @Prop({
    type: Map,
    of: Number,
    default: {}
  })
  socialNetworks: Map<SocialNetworkType, number>; // social network code => time of click

  // App store reviews
  // (note: we cannot know for sure if user is really made a review, so we just store the fact that user has clicked on the button)
  // Available store codes:
  // - appstore
  // - playstore
  @Prop({
    type: Map,
    of: Number,
    default: {}
  })
  appStoreReviews: Map<AppStoreType, number>; // store code => time of click  // NOT IMPLEMENTED YET

  // Critical action validation code
  // (used to validate critical actions like changing email, changing phone number, deleting account, etc.)
  // In the contrary of emailValidationCode, there is only one attempt allowed, so we don't need to store multiple codes
  @Prop({
    type: {
      code: String,
      time: Number
    },
    required: false
  })
  criticalActionValidationCode?: {
    code: string;
    time: number;
  };

  ///////////////////////// MENTORS / RECRUITS SECTION ////////////////

  // Mentor invitation code = short string used to identify this user as a mentor (for sponsoring)
  @Prop({
    type: String,
    required: false,
    unique: true,
    index: true, // Because when a user register, we search if the invitation code he provided matches a mentorInvitationCode of an existing user
    sparse: true, // see https://stackoverflow.com/questions/7955040/mongodb-mongoose-unique-if-not-null
    trim: true
  })
  mentorInvitationCode?: string;

  // User's mentor (if any)
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: "User",
    required: false,
    index: true, // Because we often search for recruits based on their mentor ID
    sparse: true // see https://stackoverflow.com/questions/7955040/mongodb-mongoose-unique-if-not-null
  })
  mentor?: string;

  // List of recruits
  // Map of recruit ID => (approximate) timestamp of the last activity (= general vote) for this recruit
  // (Note: this is used to know if the recruit is still active)
  @Prop({
    type: Map,
    of: RecruitActivitySchema,
    required: true,
    default: {}
  })
  recruits: Map<string, RecruitActivityMongo>; // recruit ID => last activity timestamp

  // Number of recruits with a level >= 3
  @Prop({
    type: Number,
    default: 0,
    required: false
  })
  recruitsLevel3?: number;

  ///////////////////////// GAMIFICATION SECTION //////////////////////

  // Number of points
  // (user can earn points by completing missions, voting, etc.)
  @Prop({
    type: Number,
    default: 0
  })
  points: number;

  // Level of this user
  @Prop({
    type: Number,
    default: 0
  })
  level: number;

  // Missions completed by user
  @Prop({
    type: Map,
    of: UserMissionCompletedSchema,
    required: true,
    default: {}
  })
  missionsCompleted: Map<string, UserMissionCompletedMongo>;
}

export const UserSchema = SchemaFactory.createForClass(UserMongo);
