import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { emailToKey, generateVerificationCode } from "src/common/common-functions";
import { EmailService } from "src/common/email/email.service";
import { Role } from "src/common/enum";
import { TrackEventType } from "src/event/event-types";
import { EventService } from "src/event/event.service";
import { User } from "src/profile/user/types/user.type";
import { UserMongo } from "src/profile/user/user.schema";
import { UserService } from "src/profile/user/user.service";
import { getCurrentDate } from "src/utils/date-time";
import { logInfo } from "src/utils/logger";
import { LoginWithEmailDto, VerifyCodeDto } from "./auth.dto";
@Injectable()
export class AuthService {
  constructor(
    private emailService: EmailService,
    private userService: UserService,
    private jwtService: JwtService,
    private eventService: EventService,
    @InjectModel(UserMongo.name) private readonly userModel: Model<UserMongo>
  ) {}

  async getUserByMail(email: string): Promise<User | null> {
    return this.userModel.findOne(
      { key: emailToKey(email) },
      { id: 1, password: 1, email: 1, role: 1, firstName: 1, lastName: 1 }
    );
  }

  /**
   * Attempts to log in a user using their email address and a verification code.
   *
   * This function sends a verification code to the provided email address,
   * updates the user's email validation code in the database, and returns true upon success.
   *
   * @param emailDto An object containing the user's email address.
   * @returns A boolean indicating whether the login attempt was successful.
   * @throws error if there is an error during the process.
   */
  async sendCodeWithEmail(emailDto: LoginWithEmailDto): Promise<boolean> {
    // Brute force protection: if this user asks for 3 codes in the last 15mn, block the request
    const recentAttempts = await this.userModel.findOne({
      key: emailToKey(emailDto.email),
      emailValidationCode: { $elemMatch: { time: { $gt: getCurrentDate().getTime() - 1000 * 60 * 15 } } }
    });

    if (recentAttempts && recentAttempts.emailValidationCode.length >= 3) {
      throw new UnauthorizedException("You requested too many codes recently, please retry later");
    }

    const code = generateVerificationCode();

    logInfo("sendCodeWithEmail: generating code " + code + " for " + emailDto.email);

    // Update user:
    // - add the new email validation code
    // - reset the emailValidationErrorAttempts so that the user can try to log in again
    // Note: will send exception if user does not exists
    await this.userService.updateUserDocument(emailDto.email, {
      $push: {
        emailValidationCode: { code: code, time: getCurrentDate().getTime() }
      },
      emailValidationErrorAttempts: 0
    });

    // Send verification code
    await this.emailService.sendMail({
      dynamicTemplateData: {
        code
      },
      templateId: "code_check",
      to: emailDto.email
    });

    return true;
  }

  /**
   * Verifies a verification code sent to a user's email address.
   *
   * This function attempts to find a user in the database using the provided email address
   * and verification code. If a user with the given email and code is found, it returns true,
   * indicating that the verification code is valid. Otherwise, it returns false, indicating
   * that the verification code is incorrect or expired.
   *
   * @param codeDto The data transfer object containing the user's email address and verification code.
   * @returns A boolean value indicating whether the verification code is valid.
   * @throws Error if any unexpected error occurs during the verification process.
   */
  async verifyCode(codeDto: VerifyCodeDto): Promise<boolean> {
    logInfo("Check " + codeDto.email + " " + codeDto.code);

    let user = await this.userModel.findOne({
      key: emailToKey(codeDto.email),
      emailValidationCode: {
        $elemMatch: { code: codeDto.code, time: { $gt: getCurrentDate().getTime() - 1000 * 60 * 15 } }
      } // Note: all codes since 15mn
    });

    if (
      process.env.REVIEW_APPLICATION_EMAIL &&
      codeDto.code == process.env.REVIEW_APPLICATION_CODE &&
      codeDto.email == process.env.REVIEW_APPLICATION_EMAIL &&
      codeDto.code == process.env.REVIEW_APPLICATION_CODE
    ) {
      // This is the email used by the app reviewer, with the associated code
      // => consider code is valid even if not the one sent by email
      logInfo("Code is valid (for app review)");
      user = await this.userModel.findOne({ key: emailToKey(codeDto.email) });
    }

    if (!user) {
      // Invalid code: if user exists, increment (atomically) the emailValidationErrorAttempts
      user = await this.userModel.findOne({ key: emailToKey(codeDto.email) });

      if (user) {
        logInfo("Code is invalid, incrementing emailValidationErrorAttempts for this user...");
        await this.userService.updateUserDocument(codeDto.email, { $inc: { emailValidationErrorAttempts: 1 } });

        // Brute force attack protection => if email is valid but validation code is not, we should reset emailValidationCode after 3 missed attempts
        if (user.emailValidationErrorAttempts && user.emailValidationErrorAttempts >= 2) {
          // Note: we are here before increment, so 2 means 3
          logInfo("Brute force attack detected, resetting all email validation codes...");
          await this.userService.updateUserDocument(codeDto.email, { emailValidationCode: [] });
        }
      }

      return false;
    } else {
      logInfo("Code is correct, removing all codes + reset emailValidationErrorAttempts...");
      await this.userService.updateUserDocument(codeDto.email, {
        emailValidationCode: [],
        emailValidationErrorAttempts: 0
      });

      if (user.role == Role.VISITOR) {
        // First login !
        logInfo("First login for this user");

        // Set user as "verified email" but incomplete profile
        await this.userService.updateUserRole(codeDto.email, Role.USER_INCOMPLETE);

        // Send welcome email
        await this.emailService.sendMail({
          dynamicTemplateData: {},
          templateId: "welcome",
          to: codeDto.email
        });

        // Track user registration event
        await this.eventService.trackEvent(TrackEventType.EMAIL_VERIFIED, { forceUserId: user._id }); // Force this event to be linked to the user (even if not logged in yet)
      } else {
        logInfo("Not first login for this user");
        await this.eventService.trackEvent(TrackEventType.USER_LOGIN, { forceUserId: user._id }); // Force this event to be linked to the user (even if not logged in yet)
      }

      // Track user authenticated event
      // = logged in OR registered and logged in
      await this.eventService.trackEvent(TrackEventType.USER_AUTHENTICATED, { forceUserId: user._id }); // Force this event to be linked to the user (even if not logged in yet)

      return true;
    }
  }

  /**
   * Verifies the JWT token.
   *
   * @param {string} token - The JWT token to verify.
   * @returns {any} - Returns the decoded payload of the verified token.
   * @throws {UnauthorizedException} - Throws an error if the token is expired or invalid.
   */
  verifyJwtToken(token: string) {
    try {
      return this.jwtService.verify(token, {
        secret: process.env.JWT_SECRET_KEY
      });
    } catch (error) {
      if (error.message === "jwt expired") {
        throw new UnauthorizedException({ message: "Token has expired", signature: "token_has_expired" });
      } else {
        throw new UnauthorizedException({ message: "Missing or invalid token", signature: "missing_or_invalid_token" });
      }
    }
  }
}
