import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse } from "@nestjs/swagger";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { DailyMetricsService } from "./dailymetrics.service";

@Controller("metrics")
export class DailyMetricsController {
  constructor(private readonly dailyMetricsService: DailyMetricsService) {}

  /**
   * Generate daily metrics (or regenerate) for the given day
   * (previous day by default)
   * (admin only)
   *
   * Important: generateDailyMetrics is designed to be run once per day at midnight GMT
   *            If it is run later, some data might not be accurate (those whose computing is not based on past data)
   *
   */
  @Post("generateDailyMetrics")
  @ApiOperation({ operationId: "generateDailyMetrics", summary: "Generate daily metrics for the given day" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        date: { type: "string", format: "date", description: "The date for which to generate metrics" }
      },
      required: []
    }
  })
  @ApiResponse({ status: 200, description: "Empty answer" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async generateDailyMetrics(@Body() params: { date?: string }) {
    await this.dailyMetricsService.generateDailyMetrics(params.date);
  }
}
