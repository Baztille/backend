import {
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { CreateReportDto } from "./dto/create-report.dto";
import { UpdateReportDto } from "./dto/update-report.dto";
import { ReportService } from "./report.service";

@ApiTags("Report")
@Controller("reports")
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  /**
   * Create a new report.
   *
   * @param createReportDto The data for creating a new report.
   * @returns The newly created report.
   */
  @Post()
  @ApiOperation({ operationId: "createReport", summary: "Create a new report" })
  @ApiResponse({ status: 201, description: "The report has been successfully created" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async create(@Body() createReportDto: CreateReportDto) {
    try {
      return await this.reportService.create(createReportDto);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Get all reports.
   *
   * @returns All reports available.
   */
  @Get()
  @ApiOperation({ operationId: "findAll", summary: "Get all reports" })
  @ApiResponse({ status: 200, description: "Returns all reports" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async findAll() {
    try {
      return await this.reportService.findAll();
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Find a report by its ID.
   *
   * @param id The ID of the report to find.
   * @returns The found report.
   */
  @Get(":id")
  @ApiOperation({ operationId: "findOne", summary: "Find a report by ID" })
  @ApiParam({ name: "id", type: String, description: "The ID of the report to retrieve" })
  @ApiResponse({ status: 200, description: "Returns the found report" })
  @ApiResponse({ status: 404, description: "ReportMongo not found" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async findOne(@Param("id") id: string) {
    try {
      return await this.reportService.findOne(id);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Update a report by its ID.
   *
   * @param id The ID of the report to update.
   * @param updateReportDto The data for updating the report.
   * @returns The updated report.
   */
  @Patch(":id")
  @ApiOperation({ operationId: "updateReport", summary: "Update a report by ID" })
  @ApiParam({ name: "id", type: String, description: "The ID of the report to update" })
  @ApiResponse({ status: 200, description: "The report has been successfully updated" })
  @ApiResponse({ status: 404, description: "ReportMongo not found" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR)
  async update(@Param("id") id: string, @Body() updateReportDto: UpdateReportDto) {
    try {
      return await this.reportService.update(id, updateReportDto);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Delete a report by its ID.
   *
   * @param id The ID of the report to delete.
   * @returns A message indicating the successful deletion.
   */
  @Delete(":id")
  @ApiOperation({ operationId: "remove", summary: "Delete a report by ID" })
  @ApiParam({ name: "id", type: String, description: "The ID of the report to delete" })
  @ApiResponse({ status: 200, description: "The report has been successfully deleted" })
  @ApiResponse({ status: 404, description: "ReportMongo not found" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR)
  async remove(@Param("id") id: string): Promise<any> {
    try {
      return await this.reportService.remove(id);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }
}
