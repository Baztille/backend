import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Role } from "src/common/enum";
import { LeaderboardScope } from "../leaderboard-scope.type";

export class LeaderboardUserDto {
  @ApiProperty({ description: "User identifier", example: "665f5b3fb0a1e7a9c9fdc123" })
  _id: string;

  @ApiProperty({ description: "User creation date (ISO)", example: "2025-01-15T10:23:45.123Z" })
  creationDate: string;

  @ApiProperty({ description: "User role", enum: Role })
  role: Role;

  @ApiProperty({ description: "User points used for ranking", example: 1234 })
  points: number;

  @ApiProperty({ description: "Public display name", example: "Jane D." })
  publicName?: string;

  @ApiPropertyOptional({ description: "Avatar file identifier or URL", example: "avatar_abc123" })
  avatar?: string;
}

export class LeaderboardPageDto {
  @ApiProperty({ description: "Leaderboard users page", type: () => [LeaderboardUserDto] })
  users: LeaderboardUserDto[];

  @ApiPropertyOptional({
    description: "Pagination cursor for next page (base64)",
    example: "eyJwIjoyMDAwLCJpZCI6IjY2NWY1YjM..."
  })
  nextAfter?: string;

  @ApiProperty({
    description: "Scope of the leaderboard (territory)",
    type: "object",
    properties: {
      territory_type_id: { type: "string", nullable: true, example: "commune" },
      territory_id: { type: "string", nullable: true, example: "75101" }
    }
  })
  scope: LeaderboardScope;

  @ApiProperty({ description: "Generation timestamp (ISO)", example: "2025-01-15T10:25:00.000Z" })
  generatedAt: string;
}
