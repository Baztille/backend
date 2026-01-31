import { NestFactory } from "@nestjs/core";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import * as Sentry from "@sentry/nestjs";
import * as express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createServer } from "http";
import { MigrationClient } from "../migrations/migration.client";
import { AppModule } from "./app.module";
import { ExceptionsFilter } from "./common/filter/exception.filter";
import { LoggingInterceptor } from "./common/interceptor/logging.interceptor";
import { ValidationPipe } from "./common/pipes/validation.pipe";
import { getCurrentDate } from "./utils/date-time";
import { logDebug, logInfo } from "./utils/logger";

if (process.env.SENTRY_DSN && process.env.ENVIRONMENT) {
  const sentryProps = {
    dsn: process.env.SENTRY_DSN,

    //debug: true, // Activate the SDK Sentry log, in case of issues

    // Set sampling rate for profiling - this is evaluated only once per SDK.init
    profileSessionSampleRate: 1.0,
    environment: process.env.ENVIRONMENT || "local",
    release: process.env.BACKEND_VERSION,
    enabled: process.env.ENVIRONMENT === "prod" // Enable Sentry in prod only
  };

  logInfo("Initialize Sentry using ", sentryProps);
  Sentry.init(sentryProps);
}

const PORT = process.env.PORT || "4000";

async function bootstrap() {
  logInfo("... launching Baztille backend ...");

  // Run migrations before starting the app
  await MigrationClient.run();

  logInfo("... creating app");

  const app = await NestFactory.create(AppModule, {
    bodyParser: true,
    logger: ["error", "warn"] // To prevent duplication, only log errors and warnings, other logs are handled by our LoggingInterceptor
  });

  logInfo("... setting up HTTP server");

  const httpServer = createServer(app.getHttpAdapter().getInstance());
  app.useWebSocketAdapter(new IoAdapter(httpServer));
  app.use("/asset", express.static("asset"));
  app.useGlobalPipes(new ValidationPipe());
  app.useGlobalFilters(new ExceptionsFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  logInfo("... setting up document builder");

  const options = new DocumentBuilder()
    .setTitle("Baztille")
    .setDescription("Made with love ❤️")
    .setVersion(process.env.BACKEND_VERSION ?? "VERSION_NOT_DEFINED")
    .addBearerAuth(
      {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        name: "JWT",
        description: "<b>Example: </b>`U2FsdGVkX18pqvaqDO+OXR38YIFO8QtoHqPKKvAhtMRxLX21A60xWBVKsnqSGRQL`",
        in: "header"
      },
      "JWT-auth" // This name here is important for matching up with @ApiBearerAuth() in your controller!
    )
    .build();
  const document = SwaggerModule.createDocument(app, options);
  SwaggerModule.setup("api", app, document, {
    swaggerOptions: {
      persistAuthorization: true
    }
  });

  app.use(helmet());
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization", "x-app-platform", "x-app-version", "x-device-id"]
  });
  app.use(
    rateLimit({
      windowMs: 1 * 1000,
      max: 1000,
      message: "too many request! slow down"
    })
  );

  // Starts listening for shutdown hooks
  // It consumes memory, so do not enable it unless we have a reason to do this
  // https://docs.nestjs.com/fundamentals/lifecycle-events
  // app.enableShutdownHooks();

  logInfo("Start listening...");

  await app.listen(PORT, () => {
    logInfo("~~~~ BAZTILLE SERVER IS RUNNING ~~~~");
    logInfo(`Port: ${PORT}`);
    logInfo("Backend version: " + process.env.BACKEND_VERSION);
    logInfo("Log display level: " + process.env.LOG_DISPLAY_LEVEL);

    if (process.env.FAKE_DATE) {
      logInfo("!!!!! FAKE DATE SET FOR TESTS (UTC): ", getCurrentDate());
    }

    logInfo('"To infinity & beyond"');
  });
}

logDebug("Ready to launch bootstrap...");
bootstrap();
