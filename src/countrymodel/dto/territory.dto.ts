/**
 * Territory DTO (read model exposed via API)
 * This mirrors the persisted territory but removes Mongoose decorators and ObjectId types.
 */
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TerritoryRoleEnum } from "../types/territory-role.enum";

export class TerritoryRoleDto {
  @ApiProperty({ description: "User ID having this role", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  userId: string;

  @ApiProperty({ enum: TerritoryRoleEnum, description: "Role type for this territory" })
  role: TerritoryRoleEnum;

  @ApiProperty({ description: "Timestamp (ms) since the user has this role" })
  since: number;

  @ApiPropertyOptional({ description: "Timestamp (ms) until the user had this role (undefined if still active)" })
  until?: number;
}

export class TerritorySearchResultDto {
  @ApiProperty({ description: "Territory unique identifier", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  _id: string;

  @ApiProperty({ description: "Public name of the territory" })
  name: string;

  @ApiPropertyOptional({ description: "Short name / acronym", example: "PACA" })
  shortname?: string;

  @ApiPropertyOptional({ description: "Official administrative code", example: "75056" })
  officialCode?: string;
}

export class TerritoryTypeDto {
  @ApiProperty({ description: "Territory type unique identifier", example: "64f1c2e9d8b5a1f2c3d4aaaa" })
  _id: string;

  @ApiProperty({ description: "Name of the territory type", example: "City" })
  name: string;
}

export class TerritorySummaryDto {
  /** Territory unique identifier */
  @ApiProperty({ description: "Territory unique identifier", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  _id: string;

  /** Public name of the territory */
  @ApiProperty({ description: "Public name of the territory" })
  name: string;

  /** Territory type */
  @ApiProperty({ type: () => TerritoryTypeDto, description: "Territory type" })
  type: TerritoryTypeDto;

  /** Is the territory votable? */
  @ApiProperty({ description: "Is the territory votable?" })
  isVotable: boolean;

  /**** (following properties are set only if votable) ****/

  /** What is current featured decision trigger */
  @ApiPropertyOptional({
    description: "(for votable territory only) Current featured decision trigger value",
    example: 0
  })
  currentFeaturedDecisionTrigger?: number;

  /** Chatroom associated with the territory */
  @ApiPropertyOptional({
    description: "(for votable territory only) Associated Matrix chatroom ID",
    example: "!abc123:chat.baztille.org"
  })
  chatroomId?: string;
}

export class TerritorySubdivisionDto {
  @ApiProperty({ type: () => TerritorySummaryDto, description: "Subdivision territory" })
  subdivisionId: TerritorySummaryDto;

  @ApiProperty({ description: "Whether this subdivision is a main subdivision" })
  mainSubdivision: boolean;
}

export class TerritoryOrganizationDto {
  @ApiPropertyOptional({ description: "Associated Matrix chatroom ID", example: "!abc123:chat.example.org" })
  chatroomId?: string;

  @ApiProperty({ type: () => [TerritoryRoleDto], description: "List of user roles on this territory" })
  roles: TerritoryRoleDto[];

  @ApiPropertyOptional({ description: "Election candidate or list name supported on this territory" })
  nextElectionCandidateName?: string;

  @ApiPropertyOptional({ description: "URL related to the candidate or list" })
  nextElectionCandidateUrl?: string;
}

export class TerritoryDto {
  @ApiProperty({ description: "Territory unique identifier", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  _id: string;

  @ApiProperty({ description: "Public name of the territory" })
  name: string;

  @ApiProperty({ description: "Cleaned name (ASCII / search friendly)" })
  cleanname: string;

  @ApiProperty({ description: "Territory type ID", example: "64f1c2e9d8b5a1f2c3d4aaaa" })
  type: TerritoryTypeDto;

  @ApiProperty({ description: "Is the territory active (not archived)" })
  active: boolean;

  @ApiPropertyOptional({ description: "Short name / acronym", example: "PACA" })
  shortname?: string;

  @ApiPropertyOptional({ description: "Official administrative code", example: "75056" })
  officialCode?: string;

  @ApiPropertyOptional({ description: "Registered users count (excluding visitors)" })
  registeredUsersCount?: number;

  @ApiProperty({ type: () => [TerritorySubdivisionDto], description: "List of subdivisions for this territory" })
  subdivisions: TerritorySubdivisionDto[];
}
