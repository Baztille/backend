import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class GetLeaderboardDto {
  territory_type_id: string | null; // Note: null = whole country

  @IsOptional()
  @IsString()
  territory_id?: string;

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
