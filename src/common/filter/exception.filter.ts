import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from "@nestjs/common";
import { SentryExceptionCaptured } from "@sentry/nestjs";
import { getCurrentDate } from "src/utils/date-time";
import { logError, logWarning } from "src/utils/logger";

@Catch()
export class ExceptionsFilter implements ExceptionFilter {
  @SentryExceptionCaptured()
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionObject =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            statusCode: status,
            ...exception
          };

    if (exceptionObject?.statusCode === 404) {
      // Special handling for 404 errors: minimal logging to avoid log flooding
      logWarning("404 Not Found: " + request.url, request.method);
    } else {
      if (exception.message) {
        logError("EXCEPTION catched: " + exception.message, exception);
      } else {
        logError("EXCEPTION catched: ", exception);
      }
      logError({
        ...exceptionObject,
        timestamp: getCurrentDate().toISOString(),
        path: request.url
      });
    }

    response.status(status).send({
      ...exceptionObject,
      timestamp: getCurrentDate().toISOString(),
      path: request.url
    });
  }
}
