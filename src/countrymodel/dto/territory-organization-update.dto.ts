import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsEnum, IsOptional, IsString, IsUrl, ValidateNested } from "class-validator";
import { TerritoryRoleEnum } from "../types/territory-role.enum";

export enum RoleAction {
  ADD = "ADD",
  REMOVE = "REMOVE"
}

export class TerritoryElectionCandidateUpdateDto {
  @ApiProperty({ example: "Baztille" })
  @IsString()
  name!: string;

  @ApiProperty({ example: "https://baztille.org" })
  @IsUrl()
  url!: string;
}

// A single role update item
export class TerritoryRoleUpdateDto {
  @ApiProperty({ description: "User ID", example: "66f6bb264df2ea40a01f05c5" })
  @IsString()
  // If you use MongoDB ObjectId:
  // @IsMongoId()
  userId!: string;

  @ApiProperty({ description: "Role type", enum: TerritoryRoleEnum })
  @IsEnum(TerritoryRoleEnum)
  role!: TerritoryRoleEnum;

  @ApiProperty({ description: "Action", enum: RoleAction })
  @IsEnum(RoleAction)
  action!: RoleAction;
}

// Update of a territory organization by admin user
export class TerritoryOrganizationUpdateDto {
  @ApiProperty({
    description: "Next election candidate supported by Baztille on this territory (if any)",
    type: TerritoryElectionCandidateUpdateDto
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TerritoryElectionCandidateUpdateDto)
  nextElectionCandidate?: TerritoryElectionCandidateUpdateDto;

  // Roles
  @ApiProperty({
    description: "List of users roles for Baztille on this territory to add or remove",
    type: [TerritoryRoleUpdateDto]
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => TerritoryRoleUpdateDto)
  roles?: TerritoryRoleUpdateDto[];
}
