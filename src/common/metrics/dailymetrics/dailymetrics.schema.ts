import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

/*********************************
 *
 * Daily Metrics Schema
 *
 * Metrics that are computed daily from various sources to provide long term statistics
 *
 *********************************
 */

export type DailyMetricsDocument = HydratedDocument<DailyMetricsMongo>;

export enum DailyMetricCategories {
  ACQUISITION = "ACQUISITION",
  VOTES = "VOTES",
  USERS = "USERS",
  MESSAGES = "MESSAGES",
  MISSION = "MISSION"
}

export type DailyMetricDetails = {
  description: string;
  category: DailyMetricCategories;
};

// List of all metrics that can be stored in the daily metrics, with descriptions
export const DAILY_METRICS_LIST: { [key: string]: DailyMetricDetails } = {
  total_users: {
    description: "Total number of users (with a confirmed email, non-fake and a non-deleted account)",
    category: DailyMetricCategories.USERS
  },
  total_users_members: {
    description: "Total number of users with a member status (confirm phone => right to vote)",
    category: DailyMetricCategories.USERS
  },
  new_users: {
    description: "Number of new users who signed up",
    category: DailyMetricCategories.ACQUISITION
  },
  new_users_invited: {
    description: "Number of new users who signed up using an invitation code",
    category: DailyMetricCategories.ACQUISITION
  },
  active_users: {
    description: "Number of active users (= voted during the last 28 days)",
    category: DailyMetricCategories.USERS
  },
  recent_active_users: {
    description: "Number of active users (= voted during the last 7 days)",
    category: DailyMetricCategories.USERS
  },
  general_votes_count: {
    description: "Total number of votes cast (general vote only) (modify vote does not count)",
    category: DailyMetricCategories.VOTES
  },
  first_votes_count: {
    description:
      "Number of first votes cast = users who voted a first type (general vote only)  (modify vote does not count)",
    category: DailyMetricCategories.VOTES
  },
  missions_completed: {
    description: "Number of missions completed by users",
    category: DailyMetricCategories.MISSION
  },
  missions_collected: {
    description: "Number of missions collected by users (ie: points claimed)",
    category: DailyMetricCategories.MISSION
  },
  total_users_with_points: {
    description: "Total number of users with more than 1 point",
    category: DailyMetricCategories.MISSION
  },

  users_with_at_least_1_recruit: {
    description: "Total number of users with at least 1 recruit",
    category: DailyMetricCategories.MISSION
  },
  users_with_at_least_2_recruits: {
    description: "Total number of users with at least 2 recruits",
    category: DailyMetricCategories.MISSION
  },

  // Users by level
  total_users_level_0: { description: "Users at level 0", category: DailyMetricCategories.MISSION },
  total_users_level_1: { description: "Users at level 1", category: DailyMetricCategories.MISSION },
  total_users_level_2: { description: "Users at level 2", category: DailyMetricCategories.MISSION },
  total_users_level_3: { description: "Users at level 3", category: DailyMetricCategories.MISSION },
  total_users_level_4: { description: "Users at level 4", category: DailyMetricCategories.MISSION },
  total_users_level_5: { description: "Users at level 5", category: DailyMetricCategories.MISSION },
  total_users_level_6: { description: "Users at level 6", category: DailyMetricCategories.MISSION },
  total_users_level_7: { description: "Users at level 7", category: DailyMetricCategories.MISSION },
  total_users_level_8: { description: "Users at level 8", category: DailyMetricCategories.MISSION },
  total_users_level_9: { description: "Users at level 9", category: DailyMetricCategories.MISSION }
};

export type DailyMetricKey = keyof typeof DAILY_METRICS_LIST;

@Schema({ collection: "daily_metrics" })
export class DailyMetricsMongo {
  _id?: string;

  // Timestamp for the day these metrics correspond to (UTC / start of day / milliseconds)
  // Indexed since most queries will be by date range
  @Prop({
    type: Number,
    index: true,
    required: true
  })
  timestamp: number;

  // Readable date string in format YYYY-MM-DD (for easier querying by admin)
  @Prop({
    type: String,
    index: true,
    required: true
  })
  date: string;

  // List of key => numbers pairs for various metrics
  @Prop({
    type: Map,
    of: Number,
    required: true
  })
  metrics: Map<DailyMetricKey, number>;
}

export const DailyMetricsSchema = SchemaFactory.createForClass(DailyMetricsMongo);
