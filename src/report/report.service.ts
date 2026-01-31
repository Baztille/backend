import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { checkStringExistence } from "src/common/validators/custom.validator";
import { CreateReportDto } from "./dto/create-report.dto";
import { UpdateReportDto } from "./dto/update-report.dto";
import { ReportMongo } from "./report.schema";

@Injectable()
export class ReportService {
  constructor(@InjectModel(ReportMongo.name) private readonly reportModel: Model<ReportMongo>) {}
  /**
   * Create a new report.
   * @summary Create a new report
   * @param {CreateReportDto} createReportDto - The data for creating the report.
   * @returns {Promise<Report>} A promise that resolves to the created report.
   */
  async create(createReportDto: CreateReportDto): Promise<ReportMongo> {
    // Check if title is valid
    if (!checkStringExistence(createReportDto.targetId) && !checkStringExistence(createReportDto.reporterId)) {
      throw new Error("Invalid or missing report field");
    }

    // Save report
    const report = new this.reportModel(createReportDto);
    const createdReport = await report.save();

    return createdReport;
  }

  /**
   * Retrieve all reports.
   * @summary Retrieve all reports
   * @returns {Promise<Report[]>} A promise that resolves to an array of reports.
   */
  findAll(): Promise<ReportMongo[]> {
    return this.reportModel.find();
  }

  /**
   * Retrieve a report by ID.
   * @summary Retrieve a report by ID
   * @param {string} id - The ID of the report to retrieve.
   * @returns {Promise<Report>} A promise that resolves to the retrieved report.
   */
  findOne(id: string): Promise<ReportMongo | null> {
    return this.reportModel.findById(id);
  }

  /**
   * Update a report by ID.
   * @summary Update a report by ID
   * @param {string} id - The ID of the report to update.
   * @param {UpdateReportDto} updateReportDto - The data for updating the report.
   * @returns {Promise<Report>} A promise that resolves to the updated report.
   */
  async update(id: string, updateReportDto: UpdateReportDto): Promise<ReportMongo> {
    const updatedReport = await this.reportModel.findOneAndUpdate(
      { _id: id },
      { $set: updateReportDto },
      {
        new: true
      }
    );

    if (!updatedReport) {
      throw new Error("ReportMongo not found");
    }

    return updatedReport;
  }

  /**
   * Delete a report by ID.
   * @summary Delete a report by ID
   * @param {string} id - The ID of the report to delete.
   * @returns A promise that resolves when the report is deleted.
   */
  remove(id: string): Promise<any> {
    return this.reportModel.deleteOne({ _id: id });
  }
}
