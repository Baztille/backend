///// Filters to search decisions

import { DecisionStatus } from "./decision-status.enum";

export class DecisionsFilter {
  status: DecisionStatus | null = null;
  limit = 10; // Max number of decisions to return
  featured?: boolean | undefined = undefined; // If true, only featured decisions are returned
  searchText?: string | undefined = undefined; // If set, search decisions matching this text
  after?: string | undefined = undefined; // If set, only decisions after this ID are returned (for pagination) (base54 format)
  sortBy?: DecisionsSortBy = DecisionsSortBy.FEATURED_LOCAL_HOTNESS_DATE; // Sorting order
}

// Sorting options for decisions
export enum DecisionsSortBy {
  // Featured decisions first, then
  // local (city) decisions first, then
  // hotness (most voted) desc, then
  // decision_date desc (most recently decided first)
  FEATURED_LOCAL_HOTNESS_DATE = "FEATURED_LOCAL_HOTNESS_DATE",

  // decision_date desc (most recently decided first)
  DATE_DESC = "DATE_DESC"
}

// Cursor type for paginating decisions
export type DecisionsCursor = {
  // Hotness score at the cursor position
  h: number;

  // Decision date at the cursor position (milliseconds since epoch)
  d: number;

  // Decision ID at the cursor position
  id: string;

  // Featured status at the cursor position (1 = featured, 0 = not featured)
  f: number;

  // Is local decision at the cursor position (1 = local, 0 = not local)
  l: number;
};
