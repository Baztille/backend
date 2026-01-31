import { Module } from "@nestjs/common";

import { EmailModule } from "src/common/email/email.module";
import { DailyMetricsModule } from "src/common/metrics/dailymetrics/dailymetrics.module";
import { CountrymodelModule } from "src/countrymodel/countrymodel.module";
import { DebateModule } from "src/debate/debate.module";
import { EventModule } from "src/event/event.module";
import { UserModule } from "src/profile/user/user.module";
import { DecisionModule } from "src/vote/decision/decision.module";
import { CronProvider } from "./cron.provider";

@Module({
  imports: [DecisionModule, DebateModule, EmailModule, UserModule, DailyMetricsModule, EventModule, CountrymodelModule],
  providers: [CronProvider],
  exports: [CronProvider]
})
export class CronModule {}
