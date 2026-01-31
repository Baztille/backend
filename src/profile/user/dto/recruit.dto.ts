/**
 * DTO describing a recruited user information (referral)
 */
import { ApiProperty } from "@nestjs/swagger";

// Recruit

export class RecruitActivityDto {
  @ApiProperty({ description: "ID of the last general vote session the recruit participated in" })
  lastGeneralVoteSessionId: string;

  @ApiProperty({ description: "Timestamp (ms) of the last general vote by the recruit" })
  lastGeneralVoteDate: number;
}

export class RecruitUserActivityDto {
  @ApiProperty({ description: "Timestamp (ms) of the last activity (general vote) of this recruit" })
  lastVoteTime: number; // timestamp of the last activity (general vote) of this recruit

  @ApiProperty({ description: "Current level of this recruit" })
  level: number; // current level of this recruit
}

export class RecruitDto {
  @ApiProperty({ description: "Recruited user unique identifier" })
  _id: string;

  @ApiProperty({ description: "Account creation timestamp (ms)" })
  creationDate: number;

  @ApiProperty({ description: "Public display name of the recruited user" })
  publicName: string;

  @ApiProperty({ description: "Avatar identifier of the recruited user" })
  avatar: string;

  @ApiProperty({ description: "Current level of the recruited user" })
  level: number;

  @ApiProperty({ type: () => RecruitActivityDto, description: "Recent activity data for the recruited user" })
  activity: RecruitActivityDto;

  @ApiProperty({ description: "Total points earned by the recruited user" })
  points: number;
}
