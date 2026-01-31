import { Body, Controller, Get, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { MaintenanceStatusDto } from "./status.dto";
import { StatusService } from "./status.service";

@ApiTags("Status")
@Controller("status")
export class StatusController {
  constructor(private readonly statusService: StatusService) {}

  /**
   * Set maintenance message
   * @summary Set maintenance message
   * @returns ok
   */
  @Post("setMaintenanceMessage")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "ok"
  })
  @ApiOperation({ operationId: "setMaintenanceMessage", summary: "Set maintenance message" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The maintenance message to set (empty string to disable maintenance mode)"
        },
        canVote: { type: "boolean", description: "true if users can still vote during maintenance" },
        voteCycle: { type: "boolean", description: "true if the vote cycle should continuer or not during maintenance" }
      },
      required: ["message", "canVote", "voteCycle"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async setMaintenanceMessage(@Body() params) {
    return await this.statusService.setMaintenanceMessage(params.message, params.canVote, params.voteCycle);
  }

  /**
   * Get maintenance status
   * @summary Get maintenance status
   * @return Maintenance status
   */
  @Get("getMaintenanceStatus")
  @ApiOkResponse({
    description: "Maintenance status",
    type: MaintenanceStatusDto
  })
  @ApiOperation({ operationId: "getMaintenanceStatus", summary: "Get maintenance status" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.USER, Role.MODERATOR, Role.MEMBER, Role.USER_INCOMPLETE, Role.VISITOR)
  async getMaintenanceStatus() {
    return await this.statusService.getMaintenanceStatus();
  }

  /**
   * KEPT FOR BACKWARD COMPATIBILITY (30/01/2026) - to be removed later
   * Get maintenance status
   * @summary Get maintenance status
   * @return Maintenance status
   */
  @Get("maintenanceStatus")
  @ApiOkResponse({
    description: "Maintenance status",
    type: MaintenanceStatusDto
  })
  @ApiOperation({ operationId: "maintenanceStatus", summary: "Get maintenance status" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.USER, Role.MODERATOR, Role.MEMBER, Role.USER_INCOMPLETE, Role.VISITOR)
  async getBackbackCompatibleMaintenanceStatus() {
    return await this.statusService.getMaintenanceStatus();
  }
}
