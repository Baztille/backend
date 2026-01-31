import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { EmailService } from "src/common/email/email.service";
import { Role } from "src/common/enum";
import { EventMongo } from "src/event/event.schema";
import { UserMongo } from "src/profile/user/user.schema";
import { logInfo } from "src/utils/logger";
import { DAILY_METRICS_LIST, DailyMetricsMongo } from "./dailymetrics.schema";

@Injectable()
export class DailyMetricsService {
  constructor(
    @InjectModel(DailyMetricsMongo.name) private readonly dailymetricsModel: Model<DailyMetricsMongo>,
    @InjectModel(UserMongo.name) private readonly userModel: Model<any>,
    @InjectModel(EventMongo.name) private readonly eventModel: Model<any>,
    private readonly emailService: EmailService
  ) {}

  async generateDailyMetrics(date?: string): Promise<void> {
    // Logic to generate daily metrics goes here

    if (date) {
      // Generate metrics for the specified date
      // Check date format (must be YYYY-MM-DD)
      const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(date);
      if (!isValidDate) {
        throw new Error("Invalid date format. Please use YYYY-MM-DD.");
      }
    } else {
      // Use yesterday's date
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      date = yesterday.toISOString().split("T")[0];
    }

    // Get timestamp range for the day
    const startTimestamp = new Date(`${date}T00:00:00Z`).getTime();
    const endTimestamp = new Date(`${date}T23:59:59Z`).getTime();

    logInfo(`Generating daily metrics for date: ${date}, timestamps: ${startTimestamp} - ${endTimestamp}`);

    // Create document (only if not exists)
    let dailyMetricsDoc = await this.dailymetricsModel.findOne({ timestamp: startTimestamp }).exec();
    if (!dailyMetricsDoc) {
      const emptyDoc: DailyMetricsMongo = {
        timestamp: startTimestamp,
        date: date, // Note: readable date string
        metrics: new Map<keyof typeof DAILY_METRICS_LIST, number>()
      };
      dailyMetricsDoc = await this.dailymetricsModel.create(emptyDoc);
    }

    // Generate each metric here
    // (calling one method per metric)

    for (const daily_metric_key in DAILY_METRICS_LIST) {
      // Convert snake_case to PascalCase for method naming
      const pascalCaseMethodName = daily_metric_key
        .split("_")
        .map((word, index) => {
          return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join("");

      const methodName = `compute${pascalCaseMethodName}`;
      if (typeof this[methodName] === "function") {
        const value = await this[methodName](startTimestamp, endTimestamp);
        logInfo(`Metric ${daily_metric_key} computed value: ${value}`);

        // Store the computed value in the database here
        dailyMetricsDoc.metrics.set(daily_metric_key, value);
        await dailyMetricsDoc.save();
      } else {
        logInfo(`No computation method found for metric: ${daily_metric_key} (method name: ${methodName})`);
      }
    }
  }

  public async sendDailyAdminReportEmail(date?: string): Promise<void> {
    // Logic to send daily admin report email goes here
    logInfo("Sending daily admin report email");

    // If date is not provided, use yesterday's date
    if (!date) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      date = yesterday.toISOString().split("T")[0];
    }

    // Fetch the daily metrics for the specified date
    const startTimestamp = new Date(`${date}T00:00:00Z`).getTime();
    const dailyMetrics = await this.dailymetricsModel.findOne({ timestamp: startTimestamp }).exec();

    if (!dailyMetrics) {
      logInfo(`No daily metrics found for date: ${date}. Cannot send admin report email.`);
      return;
    }

    logInfo(`Daily metrics for ${date}: ${JSON.stringify(Array.from(dailyMetrics.metrics.entries()))}`);

    // Get recipient from environment variable
    const recipientsEnv = process.env.MAIL_DAILY_REPORT_RECIPIENTS;
    if (!recipientsEnv) {
      logInfo(
        "No recipients defined for daily admin report email. Set MAIL_DAILY_REPORT_RECIPIENTS environment variable."
      );
      return;
    }

    let recipients: string[];
    try {
      recipients = JSON.parse(recipientsEnv);
    } catch (error) {
      logInfo(
        "Error parsing MAIL_DAILY_REPORT_RECIPIENTS environment variable. It should be a JSON array of email addresses."
      );
      return;
    }

    const dailyMetricsEmailContent = Array.from(dailyMetrics.metrics.entries())
      .map(([key, value]) => `${key}: <b>${value}</b>`)
      .join("<br/>\n");

    // Send email to each recipient
    for (const recipientEmail of recipients) {
      await this.sendAdminReportEmailToRecipient(recipientEmail, dailyMetricsEmailContent, date);
    }
  }

  private async sendAdminReportEmailToRecipient(
    recipientEmail: string,
    dailyMetricsEmailContent: string,
    date: string
  ): Promise<void> {
    // Logic to send email to a single recipient goes here
    logInfo(`Sending daily admin report email to ${recipientEmail} for date ${date}`);

    await this.emailService.sendMail({
      dynamicTemplateData: {
        email_content: dailyMetricsEmailContent
      },
      templateId: "admin_daily_report",
      to: recipientEmail
    });
  }

  // Common user filter to exclude visitors, fake users, and deleted accounts
  // Note: we choose to include incomplete users in the metrics
  private readonly common_user_filter = {
    role: { $ne: Role.VISITOR }, // Exclude visitors (= unconfirmed emails)
    key: { $not: /#yopmail\.com$/ }, // Exclude fake users
    removedAccountDate: { $exists: false } // Exclude deleted accounts
  };

  /////////////////////////////////////////////////////////////////////////////////////////////////////////////
  //// Private methods to compute each metric go here
  /////////////////////////////////////////////////////////////////////////////////////////////////////////////

  private async computeTotalUsers(startTimestamp: number, endTimestamp: number): Promise<number> {
    return await this.userModel.countDocuments({
      ...this.common_user_filter
    });
  }

  private async computeTotalUsersMembers(startTimestamp: number, endTimestamp: number): Promise<number> {
    return await this.userModel.countDocuments({
      ...this.common_user_filter,
      role: Role.MEMBER
    });
  }

  private async computeNewUsers(startTimestamp: number, endTimestamp: number): Promise<number> {
    return await this.userModel.countDocuments({
      ...this.common_user_filter,
      creationDate: { $gte: startTimestamp, $lt: endTimestamp }
    });
  }

  private async computeNewUsersInvited(startTimestamp: number, endTimestamp: number): Promise<number> {
    return await this.userModel.countDocuments({
      ...this.common_user_filter,
      creationDate: { $gte: startTimestamp, $lt: endTimestamp },
      mentor: { $exists: true, $ne: null }
    });
  }

  private async computeActiveUsers(startTimestamp: number, endTimestamp: number): Promise<number> {
    const twentyEightDaysAgo = startTimestamp - 28 * 24 * 60 * 60 * 1000;

    // activity.lastGeneralVoteDate must be >= twentyEightDaysAgo
    return await this.userModel.countDocuments({
      ...this.common_user_filter,
      "activity.lastGeneralVoteDate": { $gte: twentyEightDaysAgo }
    });
  }

  private async computeRecentActiveUsers(startTimestamp: number, endTimestamp: number): Promise<number> {
    const sevenDaysAgo = startTimestamp - 7 * 24 * 60 * 60 * 1000;

    // activity.lastGeneralVoteDate must be >= sevenDaysAgo
    return await this.userModel.countDocuments({
      ...this.common_user_filter,
      "activity.lastGeneralVoteDate": { $gte: sevenDaysAgo }
    });
  }

  private async computeGeneralVotesCount(startTimestamp: number, endTimestamp: number): Promise<number> {
    return await this.eventModel.countDocuments({
      type: "general_vote",
      timestamp: { $gte: startTimestamp, $lt: endTimestamp }
    });
  }

  private async computeFirstVotesCount(startTimestamp: number, endTimestamp: number): Promise<number> {
    return await this.eventModel.countDocuments({
      type: "mission_completed",
      timestamp: { $gte: startTimestamp, $lt: endTimestamp },
      "eventdata.slug": "discover_first-vote"
    });
  }

  private async computeMissionsCompleted(startTimestamp: number, endTimestamp: number): Promise<number> {
    return await this.eventModel.countDocuments({
      type: "mission_completed",
      timestamp: { $gte: startTimestamp, $lt: endTimestamp }
    });
  }

  private async computeMissionsCollected(startTimestamp: number, endTimestamp: number): Promise<number> {
    return await this.eventModel.countDocuments({
      type: "mission_collected",
      timestamp: { $gte: startTimestamp, $lt: endTimestamp }
    });
  }

  private async computeTotalUsersWithPoints(startTimestamp: number, endTimestamp: number): Promise<number> {
    return await this.userModel.countDocuments({
      ...this.common_user_filter,
      points: { $gt: 1 }
    });
  }

  private async computeUsersWithAtLeast1Recruit(startTimestamp: number, endTimestamp: number): Promise<number> {
    return this.userModel.countDocuments({
      ...this.common_user_filter,
      $expr: {
        $gt: [{ $size: { $objectToArray: { $ifNull: ["$recruits", {}] } } }, 0]
      }
    });
  }

  private async computeUsersWithAtLeast2Recruits(startTimestamp: number, endTimestamp: number): Promise<number> {
    return this.userModel.countDocuments({
      ...this.common_user_filter,
      $expr: {
        $gt: [{ $size: { $objectToArray: { $ifNull: ["$recruits", {}] } } }, 1]
      }
    });
  }

  private async computeTotalUsersAtLevel(level: number): Promise<number> {
    return await this.userModel.countDocuments({
      ...this.common_user_filter,
      level: level
    });
  }

  private async computeTotalUsersLevel0(startTimestamp: number, endTimestamp: number): Promise<number> {
    return this.computeTotalUsersAtLevel(0);
  }
  private async computeTotalUsersLevel1(startTimestamp: number, endTimestamp: number): Promise<number> {
    return this.computeTotalUsersAtLevel(1);
  }
  private async computeTotalUsersLevel2(startTimestamp: number, endTimestamp: number): Promise<number> {
    return this.computeTotalUsersAtLevel(2);
  }
  private async computeTotalUsersLevel3(startTimestamp: number, endTimestamp: number): Promise<number> {
    return this.computeTotalUsersAtLevel(3);
  }
  private async computeTotalUsersLevel4(startTimestamp: number, endTimestamp: number): Promise<number> {
    return this.computeTotalUsersAtLevel(4);
  }
  private async computeTotalUsersLevel5(startTimestamp: number, endTimestamp: number): Promise<number> {
    return this.computeTotalUsersAtLevel(5);
  }
  private async computeTotalUsersLevel6(startTimestamp: number, endTimestamp: number): Promise<number> {
    return this.computeTotalUsersAtLevel(6);
  }
  private async computeTotalUsersLevel7(startTimestamp: number, endTimestamp: number): Promise<number> {
    return this.computeTotalUsersAtLevel(7);
  }
  private async computeTotalUsersLevel8(startTimestamp: number, endTimestamp: number): Promise<number> {
    return this.computeTotalUsersAtLevel(8);
  }
  private async computeTotalUsersLevel9(startTimestamp: number, endTimestamp: number): Promise<number> {
    return this.computeTotalUsersAtLevel(9);
  }
}
