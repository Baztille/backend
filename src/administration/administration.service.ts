import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SchedulerRegistry } from "@nestjs/schedule";
import * as Sentry from "@sentry/nestjs";
import { InternalEventsEnum } from "src/common/enum/internal-events.enum";
import { CronProvider } from "src/cron-job/cron.provider";
import { logError, logInfo } from "src/utils/logger";

@Injectable()
export class AdministrationService {
  constructor(
    private readonly httpService: HttpService,
    private schedulerRegistry: SchedulerRegistry,
    private readonly cronProvider: CronProvider,
    private readonly eventEmitter: EventEmitter2
  ) {}

  /**
   * Ping debate system to check if it is online
   * @param
   * @returns basic debate system infos
   */
  async cronjobList() {
    const result: Array<{ name: string; nextDate: number | string; lastDate: number | string }> = [];
    const jobs = this.schedulerRegistry.getCronJobs();
    jobs.forEach((value, key, map) => {
      let next;
      let last;
      try {
        next = new Date(value.nextDate().toJSDate()).getTime();
      } catch (e) {
        next = "error: next fire date is in the past!";
      }
      try {
        if (value) {
          const lastdate = value.lastDate();
          if (lastdate) {
            // to comply with typescript
            last = new Date(lastdate).getTime();
          } else {
            last = "never executed";
          }
        } else {
          last = "error: last date is undefined";
        }
      } catch (e) {
        last = "error: last date is undefined";
      }

      result.push({
        name: key,
        nextDate: next,
        lastDate: last
      });
    });

    return result;
  }

  async cronjobRun(cronjob_name: string) {
    logInfo("Manually triggering Cronjob " + cronjob_name);

    const job = this.schedulerRegistry.getCronJob(cronjob_name);

    if (!job) {
      throw new Error("Invalid cronjob: " + cronjob_name);
    }

    try {
      await this.cronProvider["handleCron" + cronjob_name]();
    } catch (exception) {
      logError("Error during manual trigger of cronjob " + cronjob_name, exception);
      Sentry.captureException(exception);
    }

    return "ok";
  }

  /** Send
   * Send a backend internal event
   * (for debugging purposes)
   */
  async sendInternalEvent(eventName: InternalEventsEnum.DECISION_NEW_FEATURED_DECISION, eventData: any) {
    // Implementation for sending internal event
    this.eventEmitter.emit(eventName, eventData);
  }
}
