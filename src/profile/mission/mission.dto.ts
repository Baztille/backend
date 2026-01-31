import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { MissionCategory } from "./types/mission-category.enum";
import { MissionType } from "./types/mission-type";

export class CollectiveMissionDto {
  @ApiProperty({ description: "Unique identifier of the collective mission", example: "daily_votes" })
  id: string;

  @ApiProperty({ description: "Current progress towards the mission target", example: 45 })
  current: number;

  @ApiProperty({ description: "Target value to complete the mission", example: 100 })
  target: number;
}

export class MissionProgressionDto {
  @ApiProperty({ description: "Whether the mission is completed", example: false })
  completed: boolean;

  @ApiPropertyOptional({ description: "Whether the mission rewards have been collected", example: true })
  collected?: boolean;

  @ApiPropertyOptional({ description: "Number of prerequisite steps required", example: 2 })
  prerequisiteStepsNbr?: number;

  @ApiProperty({ description: "Number of steps completed so far", example: 1 })
  currentStepsNbr: number;

  @ApiProperty({ description: "Total number of steps to complete the mission", example: 3 })
  totalStepsNbr: number;
}

export class MissionWithUserInfoDto {
  @ApiProperty({ description: "Mission unique identifier", example: "abcd1234" })
  _id: string;

  @ApiProperty({ enum: MissionCategory, description: "Mission category" })
  category: MissionCategory;

  @ApiProperty({ enum: MissionType, description: "Mission type" })
  type: MissionType;

  @ApiPropertyOptional({ description: "Optional argument for mission type (e.g., level)" })
  typeArg?: number;

  @ApiProperty({ description: "Slug used to reference this mission in UI/links", example: "vote-first-time" })
  slug: string;

  @ApiProperty({ description: "Number of points granted when collecting the mission", example: 50 })
  points: number;

  @ApiProperty({
    description: "List of prerequisite mission IDs",
    type: [String],
    example: ["register", "enable-notifications"]
  })
  prerequisiste: string[];

  @ApiProperty({ description: "Priority for displaying this mission (higher first)", example: 10 })
  displayPriority: number;

  @ApiPropertyOptional({ description: "Timestamp (ms) when user collected the mission rewards" })
  collectionDate?: number;

  @ApiPropertyOptional({ description: "Timestamp (ms) when user completed the mission" })
  completionDate?: number;

  @ApiProperty({ description: "Progression details for the current user", type: () => MissionProgressionDto })
  progression: MissionProgressionDto;
}

export class MyMissionsListDto {
  @ApiProperty({ description: "Missions already collected by the user", type: () => [MissionWithUserInfoDto] })
  collected: MissionWithUserInfoDto[];

  @ApiProperty({ description: "Missions that can be collected now", type: () => [MissionWithUserInfoDto] })
  collectable: MissionWithUserInfoDto[];

  @ApiProperty({ description: "Missions available to start or continue", type: () => [MissionWithUserInfoDto] })
  available: MissionWithUserInfoDto[];
}
