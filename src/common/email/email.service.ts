import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import * as sgClient from "@sendgrid/client";
import { ClientRequest } from "@sendgrid/client/src/request";
import * as sgMail from "@sendgrid/mail";
import { Model } from "mongoose";
import { Role } from "src/common/enum/role.enum";
import { UserDocument, UserMongo } from "src/profile/user/user.schema";
import { cronlogError, cronlogInfo, logDebug, logError, logInfo } from "src/utils/logger";
import { ALL_USERS, SendGridTemplateList, SendMailDto } from "./send-mail.dto";

let email_templates: SendGridTemplateList = {};
try {
  email_templates = JSON.parse(process.env.SENDGRID_TEMPLATES ?? "{}");
} catch (error) {
  logError("Error during email templates initialization (probably invalid JSON in SENDGRID_TEMPLATES)");
  logError(error);
}

@Injectable()
export class EmailService {
  constructor(@InjectModel(UserMongo.name) private readonly userModel: Model<UserMongo>) {
    try {
      if (!process.env.SENDGRID_API_KEY) {
        logError("SENDGRID API KEY IS MISSING - SENDGRIG NOT INITIALIZED");
      } else {
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);
        sgClient.setApiKey(process.env.SENDGRID_API_KEY);
      }
    } catch (error) {
      logError("Error during Sendgrid initialization");
      logError(error);
    }
  }

  /**
   * Sends an email using SendGrid to a single or multiple recipients based on the provided SendMailDto.
   * Check if each recipient has opted in for the email type before sending.
   * @param sendMailDto - Data transfer object containing email details.
   * @returns A Promise that resolves when the email is sent successfully, or rejects if an error occurs.
   * @example
   * *this.emailService.sendMail({
   * *  to: 'receiver@gmail.com',
   * *  templateId: 'code_check',
   * *  dynamicTemplateData: {
   * *    username: 'User name displayed in the email',
   * *    code: 'Code displayed in the email'
   * *  }
   * * });
   */
  async sendMail(sendMailDto: SendMailDto): Promise<void> {
    if (typeof sendMailDto.to === "string") {
      logInfo("Sending email to " + sendMailDto.to + " with template " + sendMailDto.templateId);
    } else {
      logInfo(
        "Sending email to multiple recipients (" +
          sendMailDto.to.length +
          " emails) with template " +
          sendMailDto.templateId
      );
    }

    // Get corresponding Sendgrid template
    if (!email_templates[sendMailDto.templateId]) {
      throw new Error("Invalid email template id: " + sendMailDto.templateId);
    }
    const sendgridTemplateId = email_templates[sendMailDto.templateId].template;
    const defaultOption = email_templates[sendMailDto.templateId].default ?? true;

    // Build Sendgrid message
    if (process.env.MAIL_MAILER == null || process.env.MAIL_MAILER == "") {
      throw new Error("MAIL_MAILER is not configured");
    }

    const message: sgMail.MailDataRequired = {
      from: {
        email: process.env.MAIL_MAILER,
        name: process.env.MAIL_MAILER_NAME
      },
      templateId: sendgridTemplateId,
      dynamicTemplateData: sendMailDto.dynamicTemplateData
    };

    // Process email recipients list
    const rawEmailsList: string[] | null =
      sendMailDto.to == ALL_USERS ? null : sendMailDto.to instanceof Array ? sendMailDto.to : [sendMailDto.to];

    let dbBaseFiltering = {};
    if (rawEmailsList == null) {
      // ALL_USERS case => all users with confirmed email / which are not fake account or removed
      dbBaseFiltering = {
        role: { $ne: Role.VISITOR },
        key: { $not: /#yopmail\.com$/ }, // Exclude fake users
        removedAccountDate: { $exists: false }
      };
    } else {
      // specific list of emails :
      // - remove removed accounts and fake account in all cases
      dbBaseFiltering = {
        email: { $in: rawEmailsList },
        key: { $not: /#yopmail\.com$/ }, // Exclude fake users
        removedAccountDate: { $exists: false }
      };
    }

    // Filter recipients based on their email preferences
    let filteredEmailsList: { email: string }[];
    if (defaultOption === false) {
      // Get list of recipients who have opted in
      // ie:
      // - email in rawEmailsList
      // - emailsPrefs.<template_id>.option = true (if defined)
      filteredEmailsList = await this.userModel
        .find(
          {
            ...dbBaseFiltering,
            [`emailsPrefs.${sendMailDto.templateId}.option`]: true
          },
          { email: 1 }
        )
        .lean();
    } else {
      // Get list of recipients who have NOT opted out
      // ie:
      // - email in rawEmailsList
      // - emailsPrefs.<template_id>.option != false (or not defined)
      filteredEmailsList = await this.userModel
        .find(
          {
            ...dbBaseFiltering,
            $or: [
              { [`emailsPrefs.${sendMailDto.templateId}.option`]: { $ne: false } },
              { [`emailsPrefs.${sendMailDto.templateId}`]: { $exists: false } }
            ]
          },
          { email: 1 }
        )
        .lean();
    }

    if (filteredEmailsList.length === 0) {
      logInfo("No recipient to send email to after filtering by preferences - aborting");
      return;
    } else {
      logInfo("Filtered recipients count after preferences: " + filteredEmailsList.length);
      //logDebug(filteredEmailsList);
    }

    // Add recipients to message

    // Sending to multiple emails (generic case, even for single email)
    // Note: it is probable that Sendgrid has a limit on the number of recipients per email
    // (for now we do not handle this case)
    message.personalizations = [];
    for (const toEmail of filteredEmailsList) {
      message.personalizations.push({ to: [{ email: toEmail.email }] });
    }
    logDebug("Final sgMail message: ", message);

    try {
      if (process.env.SENDGRID_MOCKING_ENABLED && process.env.SENDGRID_MOCKING_ENABLED == "true") {
        logInfo("! MOCKING sendgrid (EMAIL NOT SENT) !");
      } else {
        await sgMail.send(message);
      }
    } catch (error) {
      logError("Sendmail error during sgMail.send");
      logError("sgMail parameters: ", message);
      logError("Error catched: ", error);
      if (error.response) {
        // Extract error msg
        const { message, code, response } = error;

        // Extract response msg
        const { headers, body } = response;

        logError(body);
      }
    }
  }

  /**
   * Initializes Sendgrid account for all users that do not have it already
   * @returns void
   */
  async initSendgridInfosForUsers() {
    cronlogInfo("Init Sendgrid infos for users");

    // Get 50 first users that do not have sendgridInfosCreationDate (with email confirmed / excluding visitors)
    // For each user, create a sendgrid account
    // Update the user with the sendgridInfosCreationDate

    const users: Pick<UserDocument, "email" | "emailsPrefs" | "key">[] = await this.userModel
      .find(
        {
          sendgridInfosCreationDate: { $exists: false },
          role: { $ne: Role.VISITOR },
          removedAccountDate: { $exists: false }
        },
        { email: 1, emailsPrefs: 1, key: 1 }
      )
      .limit(50);

    const contacts: { email: string }[] = [];

    for (const user of users) {
      cronlogInfo("Init Sendgrid infos for user ", user.email);

      if (this.isFakeEmail(user.email)) {
        // Skip
      } else {
        // Add contact
        contacts.push({
          email: user.email
        });
      }
    }

    const data = {
      contacts: contacts,
      list_ids: [process.env.SENDGRID_LIST_ID]
    };

    //cronlogInfo(data)

    const request: ClientRequest = {
      url: `/v3/marketing/contacts`,
      method: "PUT",
      body: data
    };

    if (contacts.length == 0) {
      cronlogInfo("No contact to add");
    } else {
      cronlogInfo("Sendgrid infos ready to upload for users. Count = ", contacts.length);

      if (await this.sendgridRequest(request)) {
        cronlogInfo("Sendgrid infos uploaded for users with success on list ", process.env.SENDGRID_LIST_ID);

        // Update sendgridInfosCreationDate for users
        for (const user of users) {
          cronlogInfo("Updating sendgridInfosCreationDate for user ", user.email);
          await this.userModel.updateOne(
            { key: user.key },
            {
              $set: { sendgridInfosCreationDate: new Date().getTime() }
            }
          );
        }

        cronlogInfo("Done");
      } else {
        cronlogError("Error during sendgridRequest, aborting updating users");
      }
    }
  }

  private isFakeEmail(email: string) {
    // Fake emails (used for test) are all using the temporary email service "yopmail"
    // We do not want to send emails to these addresses using Sendgrid
    // Thus, we fake an addition to Sendgrid while not actually adding it

    // If email is ending by @yopmail.com
    if (email.endsWith("@yopmail.com")) {
      return true;
    }

    return false;
  }

  // DEPRECATED: emails preferences are now managed only in our database
  /*
  private convertEmailsPrefsToSendgridFormat(emailsPrefs: Map<string, UserEmailOptionMongo>) {
    const user_email_prefs_sendgrid_format = {};

    emailsPrefs.forEach((email_pref, email_name) => {
      user_email_prefs_sendgrid_format["option_" + email_name] = email_pref.option ? 1 : 0;
    });

    return user_email_prefs_sendgrid_format;
  }*/

  // DEPRECATED: emails preferences are now managed only in our database
  /*async updateSendgridInfosForUser(currentUser: User) {
    logInfo("Update Sendgrid infos for user " + currentUser.email);

    const user = await this.userModel.findOne({ key: currentUser.key }, { email: 1, emailsPrefs: 1 });

    if (!user) {
      throw new Error("User not found");
    }

    if (this.isFakeEmail(currentUser.email)) {
      logInfo("Fake email, skipping");
      return;
    }

    const contacts: { email: string; custom_fields: Record<string, number> }[] = [];
    contacts.push({
      email: currentUser.email,
      custom_fields: this.convertEmailsPrefsToSendgridFormat(user.emailsPrefs)
    });

    const data = {
      contacts: contacts
    };

    logInfo(contacts);

    const request: ClientRequest = {
      url: `/v3/marketing/contacts`,
      method: "PUT",
      body: data
    };

    if (await this.sendgridRequest(request)) {
      logInfo("Sendgrid infos updated for user " + currentUser.email);
    } else {
      logError("Error during sendgridRequest, aborting updating user " + currentUser.email);
    }
  }*/

  /* Remove a user from Sendgrid contacts
   * @param email - Email of the user to remove
   */
  async removeUserFromSendgrid(email: string) {
    logInfo("Remove user " + email + " from Sendgrid");

    if (this.isFakeEmail(email)) {
      logInfo("Fake email, skipping");
      return;
    }

    // 1) lookup by email -> get contact id
    const request: ClientRequest = {
      url: `/v3/marketing/contacts/search/emails`,
      method: "POST",
      body: { emails: [email] }
    };

    const lookupBody = await this.sendgridRequest(request);

    if (!lookupBody) {
      throw new Error("Error during Sendgrid lookup for email " + email);
    }

    logInfo("Lookup result: ", lookupBody);

    const result = (lookupBody?.result || {})[email.toLowerCase()];
    const contactId: string | undefined = result?.contact?.id;

    logInfo("Contact ID: ", contactId);

    if (!contactId) {
      // If not found, nothing to do
      return;
    }

    // 2) delete the contact (async job on SendGrid side)

    const deleteRequest: ClientRequest = {
      url: `/v3/marketing/contacts`,
      method: "DELETE",
      qs: { ids: contactId }
    };

    const deleteBody = await this.sendgridRequest(deleteRequest);

    if (!deleteBody) {
      throw new Error("Error during Sendgrid delete for email " + email);
    }

    logInfo("Delete result: ", deleteBody);

    logInfo("User " + email + " removed from Sendgrid");
  }

  /* Convert an object to a base64 string that can be used as a parameter in an email URL
   * On app side, the base64 string is decoded to get the original object (see Universal Link handling)
   * @param parameters - Object to convert
   */
  buildEmailUrlParameter(parameters: any): string {
    return Buffer.from(JSON.stringify(parameters), "ascii").toString("base64");
  }

  /** Send a request to Sendgrid
   *  (unified way)
   * @param request - Request to send
   * @returns Promise or null if error
   */
  async sendgridRequest(request: ClientRequest) {
    if (process.env.SENDGRID_MOCKING_ENABLED && process.env.SENDGRID_MOCKING_ENABLED == "true") {
      logInfo("! MOCKING sendgrid (request not sent) !", request);
      return "! MOCKING sendgrid (request not sent) !";
    }

    try {
      logInfo("[SENDGRID API] Sending request : ", request);
      const [response, body] = await sgClient.request(request);

      logInfo("[SENDGRID API] answer: ", body);
      return body;
    } catch (error) {
      logError("[SENDGRID API] Error during sgClient.request");
      logError(error);
      if (error.response) {
        // Extract error msg
        const { message, code, response } = error;

        // Extract response msg
        const { headers, body } = response;

        logError(body);

        return null;
      }
    }
  }

  /**
   * Sends an email using SendGrid to a list ("Single Send") based on the provided SendMailToListDto.
   * DEPRECATED: single sends are too complex to manage (creation of segments, single sends, etc) => use sendMail instead
   * @param sendMailToListDto - Data transfer object containing email details.
   * @returns A Promise that resolves when the email is sent successfully, or rejects if an error occurs.
   * @example
   * *this.emailService.sendMailToList({
   * *  templateId: 'code_check',
   * *  dynamicTemplateData: {
   * *    username: 'User name displayed in the email',
   * *    code: 'Code displayed in the email'
   * *  }
   * * });
   */
  /* DEPRECATED */
  /*
  async sendMailToList(sendMailToListDto: SendMailToListDto): Promise<void> {
    // Send an email to all users in the list

    logInfo("Sending email to list with template " + sendMailToListDto.templateId);

    if (!email_templates[sendMailToListDto.templateId]) {
      throw new Error("Invalid email template id: " + sendMailToListDto.templateId);
    }
    const sendgridTemplateId = email_templates[sendMailToListDto.templateId].template;
    const sendgridContactsSegment = email_templates[sendMailToListDto.templateId].segment
      ? email_templates[sendMailToListDto.templateId].segment
      : null;

    if (!sendgridContactsSegment) {
      throw new Error(
        "No segment defined for template " +
          sendMailToListDto.templateId +
          " => you cannot send an email to a list without a segment"
      );
    }

    // Get corresponding template from Sendgrid
    const requestTemplate: ClientRequest = {
      url: `/v3/templates/${sendgridTemplateId}`,
      method: "GET"
    };

    const getTemplateResult: any = await this.sendgridRequest(requestTemplate);

    //logInfo("Template: ", getTemplateResult.versions)

    // Find active versions
    let template: { id: string; html_content: string; subject: string } | null = null;
    for (const version of getTemplateResult?.versions) {
      //logInfo("Version: ", version);
      if (version.active) {
        template = version;
        break;
      }
    }

    if (template == null) {
      throw new Error("No active version found for template " + sendgridTemplateId);
    }

    const email_body_template = Handlebars.compile(template.html_content);
    const email_subject_template = Handlebars.compile(template.subject);
    const email_body = email_body_template(sendMailToListDto.dynamicTemplateData);
    const email_subject = email_subject_template(sendMailToListDto.dynamicTemplateData);

    // Create new Single Send

    if (
      process.env.MAIL_MAILER == null ||
      process.env.MAIL_MAILER == "" ||
      process.env.SENDGRID_SENDER_ID == null ||
      process.env.SENDGRID_SENDER_ID == ""
    ) {
      throw new Error("MAIL_MAILER or SENDGRID_SENDER_ID is not configured");
    }

    const data = {
      name: sendMailToListDto.name,
      categories: sendMailToListDto.categories,
      send_to: {
        segment_ids: [sendgridContactsSegment]
      },
      email_config: {
        sender_id: parseInt(process.env.SENDGRID_SENDER_ID),
        subject: email_subject,
        html_content: email_body,
        custom_unsubscribe_url: "https://baztille.org/app/profile/emails-preferences"
      }
    };
    let singleSendId = null;

    if (process.env.SENDGRID_MOCKING_ENABLED && process.env.SENDGRID_MOCKING_ENABLED == "true") {
      logInfo("! MOCKING sendgrid (ABORTING SINGLE SEND) !");
      return;
    }

    const request: ClientRequest = {
      url: `/v3/marketing/singlesends`,
      method: "POST",
      body: data
    };

    try {
      logInfo("Sending request to Sendgrid: ", request);
      logInfo("Data: ", data);
      const [response, body] = await sgClient.request(request);

      singleSendId = body.id;
      logInfo("Sendgrid Single Send created with ID " + body.id);
    } catch (error) {
      logError("Sendmail error during sgClient.request");
      logError(error);
      if (error.response) {
        // Extract error msg
        const { message, code, response } = error;

        // Extract response msg
        const { headers, body } = response;

        logError(body);
      }
    }

    if (!singleSendId) {
      logError("Single Send could not be created => aborting");
      return;
    }

    // Send single send
    const sendingSingleSendrequest: ClientRequest = {
      url: `/v3/marketing/singlesends/${singleSendId}/schedule`,
      method: "PUT",
      body: { send_at: "now" }
    };

    try {
      logInfo("Sending request to Sendgrid: ", sendingSingleSendrequest);
      const [response, body] = await sgClient.request(sendingSingleSendrequest);

      logInfo("Sendgrid Single Send sent with answer: ", body);
    } catch (error) {
      logError("Sendmail error during sgClient.request");
      logError(error);
      if (error.response) {
        // Extract error msg
        const { message, code, response } = error;

        // Extract response msg
        const { headers, body } = response;

        logError(body);
      }
    }
  }
  */
}
