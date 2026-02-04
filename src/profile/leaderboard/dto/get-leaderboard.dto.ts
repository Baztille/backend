import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class GetLeaderboardDto {
  @ApiProperty({ nullable: true, required: false })
  @IsOptional()
  territoryTypeId: string | null; // Note: null = whole country

  @IsOptional()
  @IsString()
  territoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @IsString()
  after?: string; // curseur base64
}
