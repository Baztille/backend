import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { PrometheusService } from "../metrics/prometheus/prometheus.service";
import { log } from "console";
import { logInfo } from "src/utils/logger";

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly prom: PrometheusService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const http = context.switchToHttp();
    const req = http.getRequest();
    const res = http.getResponse();

    const status = String(res.statusCode ?? 0);

    // Avoid self-scrape noise and common health endpoints
    const path = (req.path || req.url || "").split("?")[0];
    if (path === "/metrics" || path === "/health" || path === "/favicon.ico") {
      return next.handle();
    }

    const start = process.hrtime.bigint();
    const method = (req.method || "GET").toUpperCase();

    // Capture one time when the response is actually sent (works for all statuses)
    res.once("finish", () => {
      const end = process.hrtime.bigint();
      const durationSec = Number(end - start) / 1e9;

      const routeTemplate =
        (req.route && req.route.path) || // Express
        req.routerPath || // Fastify
        path ||
        "unknown";

      const statusCode = String(res.statusCode ?? 0);

      if (statusCode.startsWith("3")) {
        // Filter 3xx requests as we do not care much about them
        return;
      }

      this.prom.incHttpRequests({ method, route: routeTemplate, status_code: statusCode });
      this.prom.observeHttpDuration({ method, route: routeTemplate, status_code: statusCode }, durationSec);
    });

    return next.handle();
  }
}
