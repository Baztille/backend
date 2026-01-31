import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from "@nestjs/common";
import { Observable, map } from "rxjs";
import { tap } from "rxjs/operators";
import { ApiRequest } from "src/authentication/middleware/auth.middleware";
import { getCurrentDate } from "src/utils/date-time";
import { logInfo } from "src/utils/logger";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const dateOptions: Intl.DateTimeFormatOptions = {
      timeZone: "UTC",
      month: "2-digit",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    };
    const dateFormatter = new Intl.DateTimeFormat("fr-FR", dateOptions);

    const req = context.switchToHttp().getRequest<ApiRequest>();
    const method = req.method;
    const requestingUser = req?.user;
    const url = req.url;
    const time = dateFormatter.format(getCurrentDate());

    logInfo(`[${requestingUser?.email}] ${method} ${url}`);

    const now = Date.now();
    return next.handle().pipe(
      map((data) => {
        logInfo(`[${requestingUser?.email}] ` + `<<< ${url} ` + `${Date.now() - now}ms ` + context.getClass().name);

        return data;
      })
    );
  }
}
