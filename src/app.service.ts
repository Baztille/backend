import { Injectable } from "@nestjs/common";
import { getCurrentDate, getNextOccurrenceOfHourInTimezone } from "./utils/date-time";

@Injectable()
export class AppService {
  getHello(): string {
    const now = getCurrentDate();
    const featuredFrom = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 4, 12, 0, 0, 0); // In 4 days at noon
    const newFeaturedFrom = getNextOccurrenceOfHourInTimezone(now, 4, 12, process.env.TIMEZONE_FOR_CRONJOBS || "UTC");

    console.log("Current date:", now);
    console.log("Old featuredFrom:", featuredFrom);
    console.log("New featuredFrom:", newFeaturedFrom);

    return "2∞&➤ Baztille backend " + process.env.BACKEND_VERSION;
  }
}
