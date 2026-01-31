import { ForbiddenException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { logInfo } from "src/utils/logger";
import { MaintenanceMongo } from "./schema/maintenance.schema";
import { MaintenanceStatusDto } from "./status.dto";

@Injectable()
export class StatusService {
  constructor(@InjectModel(MaintenanceMongo.name) private readonly maintenanceModel: Model<MaintenanceMongo>) {}

  /*
   * Set the maintenance message
   * @param message The maintenance message to set (empty string to disable maintenance mode)
   * @param canVote true if users can still vote during maintenance
   * @param voteCycle true if the vote cycle should continuer or not during maintenance
   * @returns ok
   */
  async setMaintenanceMessage(message: string, canVote = false, voteCycle = false) {
    logInfo("Setting maintenance message to: " + message + " and canVote: " + canVote);

    // On Maintenance DB model, there is a single document with ID "0000000000000000000000000" that must be updated
    // (or created if it does not exist)
    await this.maintenanceModel.updateOne(
      { _id: "000000000000000000000000" },
      {
        $set: {
          votesMaintenanceMessage: message,
          canVote: canVote,
          voteCycle: voteCycle
        }
      },
      { upsert: true } // Create if it does not exist
    );

    return "ok";
  }

  /**
   * Get the maintenance status
   * @returns Maintenance status
   */
  async getMaintenanceStatus(): Promise<MaintenanceStatusDto> {
    // Get the maintenance document
    const maintenance = await this.maintenanceModel.findById("000000000000000000000000").exec();

    if (!maintenance) {
      throw new ForbiddenException("Maintenance document not found");
    }

    return {
      votesMaintenanceMessage: maintenance.votesMaintenanceMessage,
      canVote: maintenance.canVote,
      voteCycle: maintenance.voteCycle
    };
  }
}
