/*
 *
 *   Mission type
 *
 *   A mission type group missions that have the same logic (= logic to trigger action success is the same)
 *
 */

import { MissionDocument } from "./../mission.schema";
import { MissionCategory } from "./mission-category.enum";

export enum MissionType {
  REGISTER = "REGISTER",
  FIRST_VOTE = "FIRST_VOTE",
  ENABLE_NOTIFICATIONS = "ENABLE_NOTIFICATIONS",
  JOIN_OUR_NETWORKS = "JOIN_OUR_NETWORKS",
  AVATAR = "AVATAR",
  VOTE_NEXT_SUBJECT = "VOTE_NEXT_SUBJECT",
  VOTE_NEXT_PROPOSITIONS = "VOTE_NEXT_PROPOSITIONS",
  STORE_REVIEW = "STORE_REVIEW",
  NBR_RECRUIT = "NBR_RECRUIT",
  ACTIVE_RECRUIT = "ACTIVE_RECRUIT",
  REACTIVATE_RECRUIT = "REACTIVATE_RECRUIT",
  SUPER_RECRUIT = "SUPER_RECRUIT",
  //VOTE_STREAK = "VOTE_STREAK",
  SENIORITY = "SENIORITY"
}

export const MISSION_TYPES = {
  REGISTER: {
    category: MissionCategory.DISCOVER
  },
  FIRST_VOTE: {
    category: MissionCategory.DISCOVER
  },
  ENABLE_NOTIFICATIONS: {
    category: MissionCategory.DISCOVER
  },
  JOIN_OUR_NETWORKS: {
    category: MissionCategory.DISCOVER
  },
  AVATAR: {
    category: MissionCategory.DISCOVER
  },
  VOTE_NEXT_SUBJECT: {
    category: MissionCategory.DISCOVER
  },
  VOTE_NEXT_PROPOSITIONS: {
    category: MissionCategory.DISCOVER
  },
  STORE_REVIEW: {
    category: MissionCategory.DISCOVER
  },
  NBR_RECRUIT: {
    category: MissionCategory.REFERRAL
  },
  ACTIVE_RECRUIT: {
    category: MissionCategory.REFERRAL
  },
  REACTIVATE_RECRUIT: {
    category: MissionCategory.REFERRAL
  },
  SUPER_RECRUIT: {
    category: MissionCategory.REFERRAL
  },
  //  VOTE_STREAK: {
  //    category: MissionCategory.ENGAGE
  //  },
  SENIORITY: {
    category: MissionCategory.ENGAGE
  }
};

export type MissionsByTypes = {
  [key: string]: {
    type: MissionType;
    category: MissionCategory;
    missions: { [key: number]: MissionDocument };
  };
};
