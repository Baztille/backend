import { Body, Controller, Get, HttpStatus, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum";
import { InternalEventsEnum } from "src/common/enum/internal-events.enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { AdministrationService } from "./administration.service";

@ApiTags("Administration")
@Controller("administration")
export class AdministrationController {
  constructor(private readonly administrationService: AdministrationService) {}

  @Get("cronjobList")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Cronjobs list"
  })
  @ApiOperation({
    operationId: "cronjobList",
    summary: "List cronjobs"
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async cronjobList() {
    return this.administrationService.cronjobList();
  }

  /**
   * Run a specific cronjob manually
   *
   * @summary Run a specific cronjob manually
   * @returns ok
   */
  @Post("cronjobRun")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "ok"
  })
  @ApiOperation({ operationId: "cronjobRun", summary: "Run a specific cronjob manually" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        cronjob: { type: "string", description: "The name of the cronjob to run" }
      },
      required: ["cronjob"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async cronjobRun(@Body() params) {
    return await this.administrationService.cronjobRun(params.cronjob);
  }

  /**
   * Send a backend internal event
   * (for debugging purposes)
   */
  @Post("sendInternalEvent")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "ok"
  })
  @ApiOperation({ operationId: "sendInternalEvent", summary: "Send a backend internal event" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        eventName: {
          type: "string",
          enum: Object.values(InternalEventsEnum),
          description: "The name of the event to send"
        },
        eventData: { type: "object", description: "The data of the event to send" }
      },
      required: ["eventName"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async sendInternalEvent(@Body() params) {
    return await this.administrationService.sendInternalEvent(params.eventName, params.eventData);
  }
}
