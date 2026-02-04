import { CountryMongo, CountrySchema } from "src/authentication/country/country.schema";
import {
  ElectedPositionTypeMongo,
  ElectedPositionTypeSchema
} from "src/countrymodel/schema/elected-position-type.schema";
import {
  ElectedRepresentativeMongo,
  ElectedRepresentativeSchema
} from "src/countrymodel/schema/elected-representative.schema";
import { TerritoryTypeMongo, TerritoryTypeSchema } from "src/countrymodel/schema/territory-type.schema";
import { TerritoryMongo, TerritorySchema } from "src/countrymodel/schema/territory.schema";
import {
  DebateArgumentMongo,
  DebateArgumentSchema,
  DebateContextMongo,
  DebateContextSchema
} from "src/debate/debate.schema";
import { EventDeviceToUserMongo, EventDeviceToUserSchema } from "src/event/event-device-to-user.schema";
import { EventMongo, EventSchema } from "src/event/event.schema";
import { MissionMongo, MissionSchema } from "src/profile/mission/mission.schema";
import { DeletedUserMongo, DeletedUserSchema } from "src/profile/user/deleted-user.schema";
import { DeviceTokenMongo, DeviceTokenSchema } from "src/profile/user/device-token.schema";
import { UserMongo, UserSchema } from "src/profile/user/user.schema";
import { ReportMongo, ReportSchema } from "src/report/report.schema";
import { MaintenanceMongo, MaintenanceSchema } from "src/status/schema/maintenance.schema";
import { DecisionMongo, DecisionSchema } from "src/vote/decision/decision.schema";
import { BallotBoxMongo, BallotBoxSchema } from "src/vote/voting-session/schema/ballot-box.schema";
import {
  BallotMongo,
  BallotRequestMongo,
  BallotRequestSchema,
  BallotSchema
} from "src/vote/voting-session/schema/ballot.schema";
import { VoterMongo, VoterSchema } from "src/vote/voting-session/schema/voter.schema";
import { VotingSessionMongo, VotingSessionSchema } from "src/vote/voting-session/voting-session.schema";
import { GlobalMongo, GlobalSchema } from "../globals/global.schema";
import { DailyMetricsMongo, DailyMetricsSchema } from "../metrics/dailymetrics/dailymetrics.schema";

export default [
  // Globals
  { name: GlobalMongo.name, schema: GlobalSchema },
  { name: MaintenanceMongo.name, schema: MaintenanceSchema },

  // User model
  { name: UserMongo.name, schema: UserSchema },
  { name: DeletedUserMongo.name, schema: DeletedUserSchema },
  { name: DeviceTokenMongo.name, schema: DeviceTokenSchema },

  // Country model
  { name: CountryMongo.name, schema: CountrySchema },
  { name: TerritoryMongo.name, schema: TerritorySchema },
  { name: TerritoryTypeMongo.name, schema: TerritoryTypeSchema },
  { name: ElectedRepresentativeMongo.name, schema: ElectedRepresentativeSchema },
  { name: ElectedPositionTypeMongo.name, schema: ElectedPositionTypeSchema },

  // Decisions & Debate
  { name: DecisionMongo.name, schema: DecisionSchema },
  { name: DebateContextMongo.name, schema: DebateContextSchema },
  { name: DebateArgumentMongo.name, schema: DebateArgumentSchema },

  // Votes
  { name: BallotMongo.name, schema: BallotSchema },
  { name: BallotRequestMongo.name, schema: BallotRequestSchema },
  { name: BallotBoxMongo.name, schema: BallotBoxSchema },
  { name: VoterMongo.name, schema: VoterSchema },
  { name: VotingSessionMongo.name, schema: VotingSessionSchema },

  // Mission
  { name: MissionMongo.name, schema: MissionSchema },

  // Events
  { name: EventMongo.name, schema: EventSchema },
  { name: EventDeviceToUserMongo.name, schema: EventDeviceToUserSchema },

  // Others
  { name: ReportMongo.name, schema: ReportSchema },
  { name: DailyMetricsMongo.name, schema: DailyMetricsSchema }
];
