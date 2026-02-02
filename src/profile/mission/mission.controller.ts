import { Body, Controller, Get, InternalServerErrorException, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiTags } from "@nestjs/swagger";
import { ApiRequest } from "src/authentication/middleware/auth.middleware";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { UserPrivateViewDto } from "../user/dto/user-private-view.dto";
import { CollectiveMissionDto, MyMissionsListDto } from "./mission.dto";
import { MissionService } from "./mission.service";

@ApiTags("Mission")
@Controller("mission")
export class MissionController {
  constructor(private readonly missionService: MissionService) {}

  /**
   * While mission module is in dev, return data we need on front end side (to be removed when mission module is fully implemented)
   * @returns data needed on front end side
   */
  /* DEPRECATED
  @Get("missionDataTmp")
  @ApiOperation({ operationId: "missionDataTmp", summary: "Get data we need on front end side mission screen" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async getMissionDataTmp(@Req() req: ApiRequest) {
    try {
      return await this.missionService.getMissionDataTmp(req?.user);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }*/

  /**
   * Get current collective mission (country wide) for this server
   * Note: while we do not reach 100k citizen, collective missions are country wide and are simply managed by this endpoint
   * @returns current collective mission
   */
  @Get("collectiveMission")
  @ApiOperation({
    operationId: "collectiveMission",
    summary: "Get current collective mission (country wide) for this server"
  })
  @ApiOkResponse({ type: CollectiveMissionDto })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER_INCOMPLETE, Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async getCollectiveMission(): Promise<CollectiveMissionDto> {
    try {
      return await this.missionService.getCollectiveMission();
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Get missions visible by current user (including accomplished missions & mission progressions)
   * @returns list of missions
   */
  @Get("myMissions")
  @ApiOperation({ operationId: "getMyMissions", summary: "Get missions visible by current user" })
  @ApiOkResponse({ type: MyMissionsListDto })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER_INCOMPLETE, Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async getMyMissions(@Req() req: ApiRequest): Promise<MyMissionsListDto> {
    try {
      return await this.missionService.getMyMissions(req?.user);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Create missions in database (admin only)
   * @returns true
   */
  @Post("createMissions")
  @ApiOperation({ operationId: "createMissions", summary: "Create missions in database (admin only)" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async createMissions() {
    try {
      return await this.missionService.createMissions();
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Check user completion for all missions (admin only)
   * Note: the missions completion check is supposed to be done automatically,
   * but this endpoint is useful to resynchronize the database with the current user activity if needed
   * @returns true
   */
  @Post("checkUserMissions")
  @ApiOperation({ operationId: "checkUserMissions", summary: "Check user completion for all missions (admin only)" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "(DEPRECATED) The ID of the user to check missions for" },
        userId: { type: "string", description: "The ID of the user to check missions for" }
      },
      required: ["userId"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async checkMissions(@Body() body: { user_id: string; userId: string }) {
    try {
      const userIdToCheck = body.userId || body.user_id;
      return await this.missionService.checkMissionsForUser(userIdToCheck);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Check all users completion for all missions (admin only)
   * Note: the missions completion check is supposed to be done automatically,
   * but this endpoint is useful to resynchronize the database with the current users activity if needed
   */
  @Post("checkAllUsersMissions")
  @ApiOperation({
    operationId: "checkAllUsersMissions",
    summary: "Check all users completion for all missions (admin only)"
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async checkAllUsersMissions() {
    try {
      return await this.missionService.checkAllUsersMissions();
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Reclaim points for a completed mission
   */
  @Post("reclaimMission")
  @ApiOperation({ operationId: "reclaimMission", summary: "Reclaim points for a completed mission" })
  @ApiOkResponse({ type: UserPrivateViewDto })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        missionType: { type: "string", description: "The type of the mission to reclaim (see mission list for types)" },
        missionTypeArg: {
          type: "number",
          description: "Optional argument for the mission type (see mission list for types)"
        }
      },
      required: ["missionType"]
    }
  })
  async reclaimMission(
    @Body() body: { missionType: string; missionTypeArg?: number },
    @Req() req: ApiRequest
  ): Promise<UserPrivateViewDto> {
    try {
      return await this.missionService.reclaimMission(
        { type: body.missionType, typeArg: body?.missionTypeArg },
        req?.user
      );
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }
}
