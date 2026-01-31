import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduleModule } from "@nestjs/schedule";
import { ServeStaticModule } from "@nestjs/serve-static";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { DatabaseModule } from "./common/database/database.module";
import forFeatureDb from "./common/database/for-feature.db";
import { SmsModule } from "./common/sms/sms.module";
import { CronModule } from "./cron-job/cron.module";
import { AuthModule } from "./authentication/auth/auth.module";
import { CountryModule } from "./authentication/country/country.module";
import { AuthMiddleware } from "./authentication/middleware/auth.middleware";
import { ChatModule } from "./chat/chat.module";
import { DebateModule } from "./debate/debate.module";
import { UserModule } from "./profile/user/user.module";
import { ReportModule } from "./report/report.module";
import { TestVoteModule } from "./vote/testvote/testvote.module";
import { DecisionModule } from "./vote/decision/decision.module";
import { CountrymodelModule } from "./countrymodel/countrymodel.module";
import { AdministrationModule } from "./administration/administration.module";
import { SettingsModule } from "./profile/settings/settings.module";
import { MissionModule } from "./profile/mission/mission.module";
import { SentryModule } from "@sentry/nestjs/setup";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { StatusModule } from "./status/status.module";
import { LeaderboardModule } from "./profile/leaderboard/leaderboard.module";
import { SupportModule } from "./support/support.module";
import { EventModule } from "./event/event.module";
import { AcceptLanguageResolver, HeaderResolver, I18nJsonLoader, I18nModule, QueryResolver } from "nestjs-i18n";
import { join } from "path";
import { ClsModule } from "nestjs-cls";
import { PrometheusModule } from "./common/metrics/prometheus/prometheus.module";
import { DailyMetricsModule } from "./common/metrics/dailymetrics/dailymetrics.module";

@Module({
  imports: [
    SentryModule.forRoot(),
    DatabaseModule,
    MongooseModule.forFeature(forFeatureDb),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ".env"
    }),
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "public"), // Path to the directory containing the images
      serveRoot: "/uploads" // Root of the URL to access static files
    }),
    I18nModule.forRoot({
      fallbackLanguage: "fr",
      loader: I18nJsonLoader,
      loaderOptions: {
        path: join(__dirname, "../i18n/"),
        watch: true
      },
      resolvers: [
        { use: QueryResolver, options: ["lang", "locale"] },
        // read Accept-Language or custom header (e.g. x-lang)
        AcceptLanguageResolver,
        new HeaderResolver(["x-lang"])
      ]
    }),
    ClsModule.forRoot({
      // Context Local Storage (used to pass infos from middleware to services)
      global: true,
      middleware: { mount: true }
    }),
    EventEmitterModule.forRoot(),
    AuthModule,
    CountryModule,
    UserModule,
    SettingsModule,
    ReportModule,
    StatusModule,
    SmsModule,
    DecisionModule,
    TestVoteModule,
    DebateModule,
    ChatModule,
    CronModule,
    CountrymodelModule,
    AdministrationModule,
    MissionModule,
    LeaderboardModule,
    SupportModule,
    EventModule,
    PrometheusModule,
    DailyMetricsModule
  ],
  controllers: [AppController],
  providers: [AppService]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      //   .exclude('auth/(.*)', 'address/(.*)', 'countrymodel/(.*)', 'country/(.*)', 'vote/results/(.*)', 'default/(.*)', {
      //     method: RequestMethod.POST,
      //     path: 'user'
      //   })
      .forRoutes("*");
  }
}
