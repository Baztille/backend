import { Controller, Get, Query, UseGuards, ValidationPipe } from "@nestjs/common";
import { ApiBearerAuth, ApiOkResponse, ApiOperation } from "@nestjs/swagger";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum";
import { RolesGuard } from "src/common/guards/roles.guard";

import { GetLeaderboardDto } from "./dto/get-leaderboard.dto";
import { LeaderboardPageDto } from "./dto/leaderboard.dto";
import { LeaderboardService } from "./leaderboard.service";

@Controller("leaderboard")
export class LeaderboardController {
  constructor(private readonly service: LeaderboardService) {}

  /**
   * Get citizens leaderboard (eventually by territories)
   * @returns list of citizens (public infos only)
   */
  @Get()
  @ApiOperation({ operationId: "getLeaderboard", summary: "Get citizens leaderboard" })
  @ApiOkResponse({ description: "Leaderboard page", type: LeaderboardPageDto })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async getLeaderboard(
    @Query(new ValidationPipe({ transform: true })) q: GetLeaderboardDto
  ): Promise<LeaderboardPageDto> {
    return this.service.getPage(
      {
        territoryId: q.territoryId ? q.territoryId : undefined,
        territoryTypeId: q.territoryTypeId ? q.territoryTypeId : undefined
      },
      q.limit ?? 50,
      q.after
    );
  }
}
