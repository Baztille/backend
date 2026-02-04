import {
  Body,
  Controller,
  HttpStatus,
  InternalServerErrorException,
  Post,
  Req,
  UnauthorizedException,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ApiRequest } from "src/authentication/middleware/auth.middleware";
import { Role } from "src/common/enum";
import { Roles } from "../decorator/roles.decorator";
import { RolesGuard } from "../guards/roles.guard";
import { SMSDto, SMSVerifyDto } from "./sms.dto";
import { SmsService } from "./sms.service";

@ApiTags("SMS")
@Controller("sms")
export class SmsController {
  constructor(private readonly smsService: SmsService) {}

  /**
   * Sends a verification code to the provided phone number .
   *
   * This endpoint allows users to request a verification code to be sent to their phone number
   * for the purpose of logging in. Upon successful processing, the verification code is sent to
   * the provided phone number.
   *
   * @summary Send verification code with phone number
   * @param smsDto The data transfer object containing the user's phone number
   * @returns Returns the result of sending the verification code.
   */
  @Post("sendCode")
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "The verification code has been sent successfully."
  })
  @ApiOperation({ operationId: "sendSmsCode", summary: "Send verification code with phone number" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @ApiBody({ type: SMSDto })
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR) // Note: not opened to Role.USER_INCOMPLETE as you must finalize registration before proceed to SMS validation
  async sendVerificationCode(@Body() smsDto: SMSDto) {
    try {
      return await this.smsService.sendVerificationCode(smsDto);
    } catch (error) {
      throw new InternalServerErrorException(error.message);
    }
  }

  /**
   * Endpoint to verify a verification code sent to a user's phone number.
   *
   * This endpoint allows users to verify a verification code sent to their phone number
   * for the purpose of completing the phone verification process. Upon successful verification,
   * appropriate action can be taken, such as activating the user's account.
   *
   * @summary Verify phone number verification code
   * @param smsDto The data transfer object containing the verification code and user's phone number.
   * @returns Returns the result of the code verification process.
   */
  @Post("verifyCode")
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: "The verification code has been successfully verified.",
    type: Object
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "The verification code is incorrect or expired."
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: "The verification code is incorrect or expired."
  })
  @ApiOperation({ operationId: "verifySmsCode", summary: "Verify phone number verification code" })
  @ApiBearerAuth("JWT-auth")
  @ApiBody({ type: SMSVerifyDto })
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR) // Note: not opened to Role.USER_INCOMPLETE as you must finalize registration before proceed to SMS validation
  async verifyCode(@Body() smsDto: SMSVerifyDto, @Req() req: ApiRequest): Promise<{ message: string }> {
    const requestingUser = req?.user;
    const verified = await this.smsService.verifyCode(smsDto, requestingUser?._id?.toString());
    if (verified) {
      return {
        message: "Verification code has been accepted"
      };
    } else {
      throw new UnauthorizedException("Verification code has expired or is incorrect");
    }
  }
}
