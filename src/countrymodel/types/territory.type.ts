/**
 * Territory business objects (not DTOs)
 */

export const COUNTRY_TERRITORY_ID = "000000000000000000000000";

export class TerritoryRole {
  /** User ID having this role */
  userId: string;

  /** Role type for this territory */
  role: string; // TerritoryRoleEnum

  /** Timestamp (ms) since the user has this role */
  since: number;

  /** Timestamp (ms) until the user had this role (undefined if still active) */
  until?: number;
}

export class TerritorySummary {
  /** Territory unique identifier */
  _id: string;

  /** Public name of the territory */
  name: string;

  /** Territory type */
  type: TerritoryType;
}

export class TerritorySubdivision {
  /** Id */
  _id: string;

  /** Subdivision territory  */
  subdivisionId: TerritorySummary;

  /** Whether this subdivision is a main subdivision (related to parent territory) */
  mainSubdivision: boolean;
}

export class VotableTerritory {
  /** Are decisions votable on this territory? */
  votableDecisions: boolean;

  /** Current hotness trigger value for this territory */
  currentFeaturedDecisionTrigger?: number;

  /** Latest featured trigger values for this territory */
  latestFeaturedDecisionTrigger?: number;

  /** Latest featured decision date on this territory */
  latestFeaturedDecisionDate?: number;

  /** Latest featured decisions hotness trigger on this territory (timestamp to trigger) */
  latestFeaturedDecisionTriggerHistory?: Map<number, number>;

  /** List of decisions linked to this territory */
  decisions?: string[];

  /** Associated Matrix chatroom ID */
  chatroomId?: string;
}

export class TerritoryOrganization {
  /** Associated Matrix chatroom ID */
  chatroomId?: string;

  /** List of user roles on this territory */
  roles: TerritoryRole[];

  /** Election candidate or list name supported on this territory */
  nextElectionCandidateName?: string;

  /** URL related to the candidate or list */
  nextElectionCandidateUrl?: string;
}

export class TerritoryType {
  /** Territory type unique identifier */
  _id: string;

  /** Name of the territory type (e.g., "City", "Region") */
  name: string;
}

export class Territory {
  /** Territory unique identifier */
  _id: string;

  /** Public name of the territory */
  name: string;

  /** Cleaned name (ASCII / search friendly) */
  cleanname: string;

  /** Territory type */
  type: TerritoryType;

  /** Is the territory active (not archived) */
  active: boolean;

  /** Short name / acronym (e.g., "PACA") */
  shortname?: string;

  /** Official administrative code (e.g., INSEE code) */
  officialCode?: string;

  /** Subdivisions of the territory */
  subdivisions?: TerritorySubdivision[];

  /** Parent territory IDs */
  parents?: TerritorySummary[];

  /** Route to parent territories */
  routeTo: { [key: string]: [string] };

  /** Registered users count (excluding visitors) */
  registeredUsersCount?: number;

  /** Organization details */
  organization?: TerritoryOrganization;

  /** Votable details */
  votableTerritory?: VotableTerritory;
}
