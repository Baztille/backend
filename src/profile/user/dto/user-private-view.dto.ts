////////////////////////////////////////////////////////////////
////// UserPrivateViewDto
////// = user data that is sent to app at each session

import { ApiExtraModels, ApiProperty, ApiPropertyOptional, getSchemaPath } from "@nestjs/swagger";
import { Role } from "src/common/enum";

import { TerritorySummaryDto } from "src/countrymodel/dto/territory.dto";
import { Territory } from "src/countrymodel/types/territory.type";
import { UserDiscoverStep } from "../types/user-discover-step.enum";
import { SocialNetworkType } from "../user.schema";
import { RecruitUserActivityDto } from "./recruit.dto";

@ApiExtraModels(RecruitUserActivityDto)
export class UserPrivateViewDto {
  @ApiProperty({ description: "User unique identifier" })
  _id: string;

  @ApiProperty({ description: "User email address" })
  email: string;

  @ApiProperty({ enum: Role, description: "User role in the system" })
  role: Role;

  @ApiProperty({ type: () => Territory, description: "User's polling station territory" })
  pollingStationId: Territory;

  @ApiPropertyOptional({ description: "Whether the polling station location is uncertain" })
  pollingStationUncertain?: boolean;

  @ApiProperty({ type: () => [TerritorySummaryDto], description: "List of territories the user belongs to" })
  territoriesInfos: TerritorySummaryDto[];

  @ApiPropertyOptional({ description: "User's public display name" })
  publicName?: string;

  @ApiProperty({ description: "User's points/score" })
  points: number;

  @ApiPropertyOptional({ description: "User's birth date as timestamp" })
  birthDate?: number;

  @ApiPropertyOptional({ description: "User's first name" })
  firstName?: string;

  @ApiPropertyOptional({ description: "User's last name" })
  lastName?: string;

  @ApiPropertyOptional({ description: "User's phone number in E.164 format" })
  phoneNumber?: string;

  @ApiProperty({ description: "Number of missions that can be collected by the user" })
  nbrCollectableMissions: number; // Note: computed from missionsCompleted field

  @ApiPropertyOptional({ description: "User's unique mentor invitation code for referring friends" })
  mentorInvitationCode?: string;

  @ApiProperty({
    type: "object",
    additionalProperties: { type: "number" },
    description: "Map of social networks joined by the user with timestamps"
  })
  socialNetworks: Map<SocialNetworkType, number>;

  @ApiPropertyOptional({ description: "User's avatar identifier" })
  avatar?: string;

  @ApiProperty({
    type: "object",
    additionalProperties: {
      $ref: getSchemaPath(RecruitUserActivityDto)
    },
    description: "Map of recruited users with their activity data (key: userId, value: recruit activity)",
    example: {
      userId123: {
        votes: 5,
        subjects: 2,
        propositions: 3,
        recruitedAt: 1672531200000
      }
    }
  })
  recruits: Map<string, RecruitUserActivityDto>;

  @ApiProperty({ enum: UserDiscoverStep, description: "User's current discovery step in the onboarding process" })
  discoverStep: UserDiscoverStep;
}
