import { BadRequestException, Injectable } from "@nestjs/common";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import { UserService } from "src/profile/user/user.service";
import { logError, logInfo } from "src/utils/logger";
import { VerificationInstance } from "twilio/lib/rest/verify/v2/service/verification";
import { SMSDto, SMSVerifyDto } from "./sms.dto";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const client = require("twilio")(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

@Injectable()
export class SmsService {
  constructor(private readonly userService: UserService) {}

  convertPhoneNumberToE164(phoneNumber: string): string {
    // Note: "FR" should not be an issue since the app is only sending phone number with +XX prefixes
    const phoneNumberE164 = parsePhoneNumberFromString(phoneNumber, "FR");
    const phoneNumberE164_string = phoneNumberE164?.format("E.164");

    if (phoneNumberE164 && phoneNumberE164_string && phoneNumberE164.isValid()) {
      logInfo("Phone number converted to E164 format = ", phoneNumberE164_string); // ➜ +14155552671
    } else {
      logError("Phone number is invalid: " + phoneNumber);
      throw new BadRequestException("This phone number is invalid");
    }

    return phoneNumberE164_string;
  }

  /**
   * Sends a verification code to the specified phone number using Twilio Verify API.
   * @param phoneNumber - The phone number to which the verification code will be sent.
   * @returns A Promise that resolves with the message object upon successful code generation, or rejects with an error.
   */
  async sendVerificationCode(smsObject: SMSDto): Promise<{ data?: { status: string } }> {
    const phoneNumberE164_string = this.convertPhoneNumberToE164(smsObject.phoneNumber);

    logInfo(
      "Sending verification code to phone number: " +
        smsObject.phoneNumber +
        " (E.164 format: " +
        phoneNumberE164_string +
        ")"
    );

    // Check if we have no user with the same phone number
    if (await this.userService.checkIfPhoneExists(phoneNumberE164_string)) {
      logError("Trying to register twice the same phone number: " + phoneNumberE164_string);
      throw new BadRequestException("This phone number is used by another user");
    }

    // Check if there is no recently deleted user with the same phone number
    if (await this.userService.checkIfPhoneExistsInDeletedUsers(phoneNumberE164_string)) {
      logError("Trying to register a phone number used by a recently deleted user: " + phoneNumberE164_string);
      throw new BadRequestException("This phone number belongs to a recently deleted user");
    }

    if (process.env.TWILIO_MOCKING_ENABLED && process.env.TWILIO_MOCKING_ENABLED == "true") {
      // Mocking Twilio
      logInfo("Note: Mocking Twilio - without Mocking a SMS would have been sent to " + phoneNumberE164_string);
      logInfo("Please use the code 9999 to verify your phone number (mocked)");
      return { data: { status: "ok (mocked)" } };
    } else {
      const message: VerificationInstance = await client.verify.v2
        .services(process.env.TWILIO_SERVICE_SID)
        .verifications.create({
          to: phoneNumberE164_string,
          channel: "sms"
        });
      return {
        data: { status: message.status }
      };
    }
  }
  /**
   * Verifies the provided code against the specified phone number using Twilio Verify API.
   * @param phoneNumber - The phone number to be verified.
   * @param code - The verification code to be checked against.
   * @returns A Promise that resolves with a boolean indicating whether the provided code is valid,
   * or rejects with an error.
   */
  async verifyCode(smsObject: SMSVerifyDto, userId: string) {
    let bPhoneNumberVerified = false;
    let phoneNumber = smsObject.phoneNumber;
    let phoneNumberE164_string = this.convertPhoneNumberToE164(phoneNumber);

    if (process.env.TWILIO_MOCKING_ENABLED && process.env.TWILIO_MOCKING_ENABLED == "true") {
      // Mocking Twilio:
      // 9999 is a correct code
      // any other code is an incorrect code

      if (smsObject.code == "9999") {
        bPhoneNumberVerified = true;
      }
    } else {
      const verificationCheck = await client.verify.v2
        .services(process.env.TWILIO_SERVICE_SID)
        .verificationChecks.create({
          to: phoneNumberE164_string,
          code: smsObject.code
        });
      bPhoneNumberVerified = verificationCheck.valid;
      phoneNumber = verificationCheck.to; // Overwrite phoneNumber with the one returned by Twilio to make sure we store the right one
      phoneNumberE164_string = this.convertPhoneNumberToE164(phoneNumber);
    }

    if (bPhoneNumberVerified) {
      logInfo("Phone number verification succeed for " + phoneNumber);
      logInfo("Phone number returned by Twilio (E.164 format): " + phoneNumberE164_string);

      // Record phone number for this user + set it to "MEMBER"
      // Note: we do not check that user have first
      await this.userService.updateToMember(userId, phoneNumberE164_string);
    } else {
      logInfo("Phone number verification failed for " + smsObject.phoneNumber);
    }

    return bPhoneNumberVerified;
  }
}
