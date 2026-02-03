import { Body, Controller, Get, InternalServerErrorException, Post, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { ApiRequest } from "src/authentication/middleware/auth.middleware";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { EmailsPreferencesByCategoryDto } from "./settings.dto";
import { SettingsService } from "./settings.service";

@ApiTags("Settings")
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  /**
   * Get all possible emails types that can be sent
   * @returns list of emails with categories
   */
  @Get("emailsTypes")
  @ApiOperation({ operationId: "getEmailsTypes", summary: "Get all possible emails types that can be sent" })
  @ApiOkResponse({
    description: "Returns list of email types with categories and user preferences",
    type: [EmailsPreferencesByCategoryDto]
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER_INCOMPLETE, Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async getEmailsTypes(@Req() req: ApiRequest): Promise<EmailsPreferencesByCategoryDto[]> {
    try {
      return await this.settingsService.getEmailsTypes(req?.user);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Set email preference (optin/optout) for a user
   * @param email_type type of email
   * @param option optin or optout (true/false)
   */
  @Post("emailPreference")
  @ApiOperation({ operationId: "setEmailPreference", summary: "Set email preference (optin/optout) for a user" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        email_type: { type: "string", description: "Type of email to set preference for (see /settings/emails_types)" },
        option: { type: "boolean", description: "true for optin, false for optout" }
      },
      required: ["email_type", "option"]
    }
  })
  @ApiResponse({
    status: 201,
    description: "Preference saved"
  })
  @ApiConsumes("application/json")
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER_INCOMPLETE, Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async setEmailPreference(@Body() params, @Req() req: ApiRequest) {
    try {
      return await this.settingsService.setEmailPreference(req?.user, params.email_type, params.option);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }
}
