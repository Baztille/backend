import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EmailService } from "src/common/email/email.service";
import { SendGridTemplateList } from "src/common/email/send-mail.dto";
import { getCurrentDate } from "src/utils/date-time";
import { logInfo } from "src/utils/logger";
import { User } from "../user/types/user.type";
import { UserMongo } from "../user/user.schema";
import { UserService } from "../user/user.service";
import { EmailsPreference, EmailsPreferencesByCategory } from "./settings.types";

const email_templates: SendGridTemplateList = JSON.parse(process.env.SENDGRID_TEMPLATES ?? "{}");

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(UserMongo.name) private readonly userModel: Model<UserMongo>,
    private emailService: EmailService,
    private userService: UserService
  ) {}

  async getEmailsTypes(currentUser: User): Promise<EmailsPreferencesByCategory[]> {
    // Get current user email preferences
    const user = await this.userService.getUserCompleteByEmail(currentUser.email);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    console.log("Email preferences for ", currentUser.email, user);

    const emails_list: { [key: string]: EmailsPreference[] } = {};

    for (const email_type in email_templates) {
      const category = email_templates[email_type].category;

      if (!emails_list[category]) {
        emails_list[category] = [];
      }

      const defaultOptionRaw = email_templates[email_type].default;
      const defaultOption = defaultOptionRaw ? defaultOptionRaw : true;

      const userPrefRaw = user.emailsPrefs.get(email_type);
      const userPreference = userPrefRaw ? userPrefRaw.option : undefined;

      const optionValue = userPreference !== undefined ? userPreference : defaultOption;

      emails_list[category].push({
        name: email_type,
        default: defaultOption,
        userpref: userPreference,
        option: optionValue
      });
    }

    // Transform the object into an array
    const emailsListArray: EmailsPreferencesByCategory[] = [];
    for (const category in emails_list) {
      emailsListArray.push({
        category: category,
        emails: emails_list[category]
      });
    }

    return emailsListArray;
  }

  /**
   * Set email preference (optin/optout) for a user
   * @param email_type
   * @param optin
   * @returns true if successful
   */
  async setEmailPreference(currentUser: User, email_type: string, option: boolean): Promise<boolean> {
    logInfo("setEmailPreference for ", currentUser.email, email_type, option);

    const user = await this.userService.getUserCompleteByEmail(currentUser.email);

    if (!user) {
      throw new NotFoundException("User not found");
    }

    // Validate email_type
    if (!email_templates[email_type]) {
      throw new BadRequestException("Invalid email_type");
    }

    const currentTime = getCurrentDate().getTime();
    const field_name = "emailsPrefs." + email_type;
    const updateData = {
      [field_name]: {
        option: option,
        date: currentTime
      }
    };

    await this.userModel.updateOne({ email: currentUser.email }, { $set: updateData });

    // Update data on Sendgrid
    // DEPRECATED: emails preferences are now managed only in our database
    //await this.emailService.updateSendgridInfosForUser(currentUser);

    return true;
  }
}
