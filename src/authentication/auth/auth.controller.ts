import {
  Body,
  Controller,
  HttpStatus,
  InternalServerErrorException,
  Post,
  UnauthorizedException
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { UserService } from "src/profile/user/user.service";
import { LoginWithEmailDto, VerifyCodeDto, VerifyCodeResponseDto } from "./auth.dto";
import { AuthService } from "./auth.service";

@ApiTags("Auth")
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JwtService,
    private readonly userService: UserService
  ) {}

  /**
   * Sends a verification code to the provided email address for email-based login.
   *
   * This endpoint allows users to request a verification code to be sent to their email address
   * for the purpose of logging in. Upon successful processing, the verification code is sent to
   * the provided email address.
   *
   * @summary Send verification code with email
   * @param loginWithEmailDto The data transfer object containing the user's email address.
   * @returns Returns the result of sending the verification code.
   */
  @Post("sendCode")
  @ApiOperation({ operationId: "sendCode", summary: "Send verification code with email" })
  @ApiBody({ type: LoginWithEmailDto })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "The verification code has been sent successfully."
  })
  async sendCodeWithEmail(@Body() loginWithEmailDto: LoginWithEmailDto) {
    return await this.authService.sendCodeWithEmail(loginWithEmailDto);
  }

  /**
   * Endpoint to verify a verification code sent to a user's email address.
   *
   * This endpoint allows users to verify a verification code sent to their email address
   * for the purpose of completing the email verification process. Upon successful verification,
   * generate access token
   *
   * @summary Verify email verification code
   * @param codeDto The data transfer object containing the verification code and user's email.
   * @returns Returns the result of the code verification process.
   */
  @Post("verifyCode")
  @ApiOperation({ operationId: "verifyCode", summary: "Verify email verification code" })
  @ApiBody({ type: VerifyCodeDto })
  @ApiOkResponse({
    type: VerifyCodeResponseDto
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: "The verification code is incorrect or expired."
  })
  async verifyCode(@Body() codeDto: VerifyCodeDto): Promise<VerifyCodeResponseDto> {
    try {
      const verified = await this.authService.verifyCode(codeDto);
      if (verified) {
        // Generate access token
        const userLogged = await this.userService.getUserPrivateByEmail(codeDto.email);
        const payload = {
          userId: userLogged._id,
          role: userLogged.role
        };

        const accessToken = this.jwtService.sign(payload, {
          expiresIn: process.env.ACCESS_TOKEN_TIMEOUT || "1d",
          secret: process.env.JWT_SECRET_KEY
        });

        return {
          data: {
            user: userLogged,
            accessToken
          },
          message: "Verification code has been accepted"
        };
      } else {
        throw new UnauthorizedException("Verification code has expired or is incorrect");
      }
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }
}
