// src/common/metrics/prometheus.service.ts
import { Injectable } from "@nestjs/common";
import * as client from "prom-client";

type Labels = { method: string; route: string; status_code: string };

@Injectable()
export class PrometheusService {
  private readonly register: client.Registry;

  // Expose metrics so other parts (e.g. interceptor) can use them
  public readonly httpRequestsTotal: client.Counter<string>;
  public readonly httpRequestDuration: client.Histogram<string>;

  constructor() {
    this.register = new client.Registry();

    // Default labels visible on *all* metrics
    this.register.setDefaultLabels({ app: "baztille" });

    // Node/process default metrics (CPU, memory, GC, event loop…)
    client.collectDefaultMetrics({ register: this.register });

    // ---- HTTP metrics (custom) ----
    this.httpRequestsTotal = new client.Counter({
      name: "http_requests_total",
      help: "Total number of HTTP requests",
      labelNames: ["method", "route", "status_code"],
      registers: [this.register]
    });

    this.httpRequestDuration = new client.Histogram({
      name: "http_request_duration_seconds",
      help: "HTTP request duration in seconds",
      labelNames: ["method", "route", "status_code"],
      // Buckets tuned for typical web API latencies
      buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.register]
    });
  }

  // Helper methods (optional but convenient)
  incHttpRequests(labels: Labels) {
    this.httpRequestsTotal.inc(labels);
  }

  observeHttpDuration(labels: Labels, seconds: number) {
    this.httpRequestDuration.observe(labels, seconds);
  }

  getMetrics(): Promise<string> {
    return this.register.metrics();
  }
}
