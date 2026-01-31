// src/common/metrics/prometheus.module.ts
import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { PrometheusController } from "./prometheus.controller";
import { PrometheusService } from "./prometheus.service";
import { HttpMetricsInterceptor } from "../../interceptor/http-metrics.interceptor";

@Module({
  controllers: [PrometheusController],
  providers: [
    PrometheusService,
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor } // global interceptor
  ],
  exports: [PrometheusService]
})
export class PrometheusModule {}
