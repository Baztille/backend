import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import * as Sentry from "@sentry/nestjs";
import * as dotenv from "dotenv";
import { EmailService } from "src/common/email/email.service";
import { DailyMetricsService } from "src/common/metrics/dailymetrics/dailymetrics.service";
import { CountrymodelService } from "src/countrymodel/countrymodel.service";
import { DebateArgumentService } from "src/debate/debate-argument.service";
import { DebateContextService } from "src/debate/debate-context.service";
import { EventService } from "src/event/event.service";
import { UserService } from "src/profile/user/user.service";
import { cronlogError, cronlogInfo, logDebug, logError, logInfo } from "src/utils/logger";
import { DecisionService } from "src/vote/decision/decision.service";

dotenv.config();

const CRON_TIME =
  process.env.MODE_VOTE_DURATION === "test"
    ? {
        BEFORE_GENERAL_VOTE: "*/20 * * * *", // every 20 minutes
        BEFORE_PROPOSITIONS_SELECTION: "*/20 * * * *"
      }
    : {
        // PRODUCTION VALUES

        BEFORE_GENERAL_VOTE: "0 12 * * 0", // every Sunday noon
        BEFORE_PROPOSITIONS_SELECTION: "0 12 * * 3" // every Wednesday noon
      };

@Injectable()
export class CronProvider {
  constructor(
    private readonly decisionService: DecisionService,
    private readonly debateContextService: DebateContextService,
    private readonly debateArgumentService: DebateArgumentService,
    private readonly dailyMetricsService: DailyMetricsService,
    private emailService: EmailService,
    private userService: UserService,
    private eventService: EventService,
    private countrymodelService: CountrymodelService
  ) {}
  /*

  // DEPRECATED: now, decisions status are triggered by users actions (voting), not by cronjobs

  @Cron( CRON_TIME.BEFORE_GENERAL_VOTE, {             // Every sunday noon 
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: 'SundayNoon'   
  })  
  async handleCronSundayNoon() {

    try
    {
      cronlogInfo("CRONJOB STARTS: before general vote");
      // End general vote
      await this.decisionService.voteLifeCycle_end_vote();
  
      // Proposition selection + start new general vote
      await this.decisionService.voteLifeCycle_proposition_selection();

      // Initialize debate context (for the new general vote)
      await this.debateContextService.initDebateContext( );
  
      // Start new vote session
      await this.decisionService.voteLifeCycle_start_new();
  
      cronlogInfo("CRONJOB ENDS: before general vote");
    }
    catch( exception )
    {
      this.logCronjobException( 'handleCronSunday', exception );
    }
  }*/

  /*

  DEPRECATED: now, decisions status are triggered by users actions (voting), not by cronjobs

  @Cron( CRON_TIME.BEFORE_PROPOSITIONS_SELECTION, { 
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: 'WednesdayNoon'
  })
  async handleCronWednesdayNoon() {
    try
    {
      cronlogInfo("CRONJOB STARTS: before propositions selection");

      // Subject selection
      this.decisionService.voteLifeCycle_subject_selection();

      cronlogInfo("CRONJOB ENDS: before propositions selection");
    }
    catch( exception )
    {
      this.logCronjobException( 'handleCronWednesday', exception );
    }      
  }
*/

  /*
DEPRECATED: to be recycled later
  @Cron( '5 12 * * 0', {  // Every Sunday at 12:05  
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: 'FillSubjectUsingAI'   
  })  
  async handleCronFillSubjectUsingAI() {

    try
    {
      logInfo("Add 4 new subjects (using AI) in order to avoid having an empty subject list when there is a new decision");
      await this.decisionService.fillSubjectUsingAI();
    }
    catch( exception )
    {
      this.logCronjobException( 'handleCronFillSubjectUsingAI', exception );
    } 
  }      

  @Cron( '5 12 * * 3', {  // Every Wednesday at 12:05  
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: 'FillPropositionsUsingAI'   
  })  
  async handleCronFillPropositionsUsingAI() {
    try
    {
      logInfo("Add 4 new propositions (using AI) in order to avoid having an empty proposition list when there is a new decision");
      await this.decisionService.fillPropositionsUsingAI();
    }
    catch( exception )
    {
      this.logCronjobException( 'handleCronFillPropositionsUsingAI', exception );
    } 
  }
        

  @Cron( '5 12 * * 0', {  // Every Sunday at 12:05  
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: 'FillDebateUserAI'   
  })  
  async handleCronFillDebateUserAI() {
    try
    {    
      logInfo("Fill debate (subject context & arguments for and against every proposition) in order to avoid having an empty debate");
      await this.debateContextService.fillDebateContextUsingAI();
      await this.debateArgumentService.fillDebateArgumentsUsingAI();
    }
    catch( exception )
    {
      this.logCronjobException( 'handleCronFillDebateUserAI', exception );
    } 
  }
    */

  /*

  DEPRECATED as there is no more fixed voting schedule. To be recycled later.

  @Cron( '5 12 * * 6', { // Every Saturday at 12:05
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: 'SendEmailReminderVoters'
  })
  async handleCronSendEmailReminderVoters() {
    try
    {
      logInfo("Send email reminder to users that have not voted yet for the ongoing general vote");
      await this.decisionService.sendEmailVoteReminderVoters();
    }
    catch( exception )
    {
      this.logCronjobException( 'handleCronSendEmailReminderVoters', exception );
    }
  }

  */

  @Cron(CronExpression.EVERY_HOUR, {
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: "MoveDecisionsToFeatured"
  })
  async handleCronMoveDecisionsToFeatured() {
    try {
      logInfo("Move decisions to featured (=> general vote status) if their featureFrom date is reached");

      await this.decisionService.moveDecisionsToFeatured();
    } catch (exception) {
      this.logCronjobException("handleCronMoveDecisionsToFeatured", exception);
    }
  }

  @Cron("0 12 * * *", {
    // Every day at noon
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: "UpdateTerritoriesFeaturedDecisionTrigger"
  })
  async handleCronUpdateTerritoriesFeaturedDecisionTrigger() {
    try {
      logInfo("Update territories featured decision trigger");

      await this.countrymodelService.updateTerritoriesFeaturedDecisionTrigger();
    } catch (exception) {
      this.logCronjobException("handleCronUpdateTerritoriesFeaturedDecisionTrigger", exception);
    }
  }

  @Cron(CronExpression.EVERY_30_MINUTES, {
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: "InitSendgridInfos"
  })
  async handleCronInitSendgridInfos() {
    try {
      cronlogInfo("Create Sendgrid account for all users that do not have already");

      this.emailService.initSendgridInfosForUsers();
    } catch (exception) {
      this.logCronjobException("handleCronInitSendgridInfos", exception);
    }
  }

  @Cron("5 12 * * 0", {
    // Every Sunday at 12:05
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: "UpdateMaxNumberOfVoters"
  })
  async handleCronUpdateMaxNumberOfVoters() {
    try {
      logInfo("Update the maximum number of voters (for the 5 latest decision) global variable");

      await this.decisionService.updateMaxNumberOfVoters();
    } catch (exception) {
      this.logCronjobException("handleCronUpdateMaxNumberOfVoters", exception);
    }
  }

  /*
  DEPRECATED: there is no more fixed voting schedule. To be recycled later.

  @Cron( '10 12 * * 0', {  // Every Sunday at 12:10
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: 'SendEmailNewGeneralVote'   
  })  
  async handleCronSendEmailNewGeneralVote() {
    try
    {
      logInfo("Send the weekly email about the new general vote");
      
      await this.decisionService.sendEmailNewGeneralVote();
    }
    catch( exception )
    {
      this.logCronjobException( 'handleCronSendEmailNewGeneralVote', exception );
    }
  }    */

  @Cron("0 4 * * 1", {
    // Every Monday at 04:00
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: "CacheTerritoriesForUsers"
  })
  async handleCronCacheTerritoriesForUsers() {
    try {
      logInfo(
        "Cache territories for users: store in every user (that do not have this done yet) the list of territories he is linked to (for elected representatives, etc.)"
      );
      // Note: this is done at registration for each user, so this is only a catchup (fallback)

      await this.userService.cacheTerritoriesForUsers();
    } catch (exception) {
      await this.logCronjobException("handleCronCacheTerritoriesForUsers", exception);
    }
  }

  @Cron(CronExpression.EVERY_HOUR, {
    // Every Hour
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: "RefreshNumberOfCitizens"
  })
  async handleCronRefreshNumberOfCitizens() {
    try {
      logInfo("Refresh the number of citizens (which validated their email) global variable");

      await this.userService.updateTotalNumberOfCitizens();
    } catch (exception) {
      await this.logCronjobException("handleCronRefreshNumberOfCitizens", exception);
    }
  }

  // Daily metrics
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    //timeZone: process.env.TIMEZONE_FOR_CRONJOBS, // DO NOT set timezone so that it runs at midnight UTC
    name: "DailyMetricsComputation"
  })
  async handleCronDailyMetricsComputation() {
    try {
      cronlogInfo("Start daily metrics computation");

      await this.dailyMetricsService.generateDailyMetrics();
    } catch (exception) {
      this.logCronjobException("handleCronDailyMetricsComputation", exception);
    }
  }

  // Send daily admin report email
  @Cron(CronExpression.EVERY_DAY_AT_2AM, {
    //timeZone: process.env.TIMEZONE_FOR_CRONJOBS, // Send it 2 hours after midnight UTC
    name: "DailyAdminReportEmail"
  })
  async handleCronDailyAdminReportEmail() {
    try {
      cronlogInfo("Send daily admin report email");

      await this.dailyMetricsService.sendDailyAdminReportEmail();
    } catch (exception) {
      this.logCronjobException("handleCronDailyAdminReportEmail", exception);
    }
  }

  // Process user/device linking events
  @Cron(CronExpression.EVERY_10_MINUTES, {
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: "UserDeviceLinkingEvents"
  })
  async handleCronUserDeviceLinkingEvents() {
    try {
      cronlogInfo("Process user/device linking events");

      await this.eventService.processUserDeviceLinkingEvents();
    } catch (exception) {
      this.logCronjobException("handleCronUserDeviceLinkingEvents", exception);
    }
  }

  // Upload events to analytics platform
  // Every 10 minutes with a 5 minutes delay after the 10-minutes user/device linking events cronjob
  @Cron("5,15,25,35,45,55 * * * *", {
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: "UploadEventsToAnalytics"
  })
  async handleCronUploadEventsToAnalytics() {
    try {
      cronlogInfo("Upload events to external analytics system");

      await this.eventService.uploadEventsToAnalyticsSystem();
    } catch (exception) {
      this.logCronjobException("handleCronUploadEventsToAnalytics", exception);
    }
  }

  // Update users count per territory
  // Every hour, 12 minutes after the hour
  @Cron("12 * * * *", {
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: "UpdateUsersCountPerTerritory"
  })
  async handleCronUpdateUsersCountPerTerritory() {
    try {
      cronlogInfo("Update user count per territory");

      await this.userService.updateUsersCountPerTerritory();
    } catch (exception) {
      this.logCronjobException("handleCronUploadEventsToAnalytics", exception);
    }
  }

  //@Cron(CronExpression.EVERY_DAY_AT_NOON)
  //async handleCronDaily() {
  //}

  /*@Cron(CronExpression.EVERY_10_SECONDS, { timeZone: process.env.TIMEZONE_FOR_CRONJOBS } )
  async handleCronMinute() {
    try
    {
      throw new Error("TEST SENTRY Exception during a real cron !");      
    }
    catch( exception )
    {
      this.logCronjobException( 'handleCronMinute', exception );
    }       
  }*/

  @Cron(CronExpression.EVERY_6_MONTHS, {
    timeZone: process.env.TIMEZONE_FOR_CRONJOBS,
    name: "TestCronjob"
  })
  async handleCronTestCronjob() {
    try {
      cronlogInfo("This is a cronjob used for testing purpose");
    } catch (exception) {
      this.logCronjobException("handleCronTestCronjob", exception);
    }
  }

  /////////////// Cronjob error handling //////////

  logCronjobException(cronjobName, exception) {
    let message = "EXCEPTION during cronjob " + cronjobName;
    if (exception.message) {
      message += ": " + exception.message;
    }

    cronlogError(message, exception);
    logError(message, exception); // => also log error in general log so we make sure we do not miss it

    // Send it to Sentry
    let errorMessage = typeof message === "string" ? message : JSON.stringify(message, null, 2);
    if (exception) {
      errorMessage += " - " + JSON.stringify(exception, null, 2);
    }

    const sentryEventId = Sentry.captureException(new Error(errorMessage));
    logDebug("Sentry event ID = " + sentryEventId);
  }
}
