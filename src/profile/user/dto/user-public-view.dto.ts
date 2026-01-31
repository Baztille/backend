////////////////////////////////////////////////////////////////
////// UserPublicViewDto
////// = user data that is public (visible by other users)

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Role } from "src/common/enum/role.enum";

export class UserPublicViewDto {
  @ApiProperty({ description: "User unique identifier" })
  _id: string;

  @ApiProperty({ enum: Role, description: "User role in the system" })
  role: Role;

  @ApiPropertyOptional({ description: "User's public display name" })
  publicName?: string;

  @ApiProperty({ description: "User's points/score" })
  points: number;

  @ApiPropertyOptional({ description: "User's avatar identifier" })
  avatar?: string;

  @ApiProperty({ description: "User account creation date as timestamp" })
  creationDate: number;
}
