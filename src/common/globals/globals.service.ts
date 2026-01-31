import { Injectable } from "@nestjs/common";

import { cronlogError, cronlogInfo, logDebug, logError, logInfo } from "src/utils/logger";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model } from "mongoose";
import { GlobalMongo } from "./global.schema";
import { GlobalKey } from "src/common/globals/globals.enum";

@Injectable()
export class GlobalsService {
  private globalsIndex: { [key: string]: number };

  constructor(@InjectModel(GlobalMongo.name) private readonly globalModel: Model<GlobalMongo>) {}

  /*
   * Convert a global variable index to its corresponding MongoDB _id
   * @param index - Index of the global variable
   * @returns MongoDB _id of the global variable
   */
  globalIndexNumberToId(index: number): string {
    return index.toString().padStart(24, "0");
  }

  /**
   * Set a global variable
   * @param key - Key of the global variable
   * @param value - Value of the global variable
   * @returns void
   */
  async setGlobal<T>(key: GlobalKey, value: T): Promise<void> {
    try {
      // Update the global variable (or create it if it does not exist)
      await this.globalModel.updateOne(
        { _id: this.globalIndexNumberToId(key) },
        { $set: { value: value } },
        { upsert: true }
      );
    } catch (error) {
      logError(`Error while setting global variable ${key}: ${error}`);
    }
  }

  /* Get a global variable
   * @param key - Key of the global variable
   * @returns Value of the global variable or undefined if it has never been set
   */
  async getGlobal<T>(key: GlobalKey): Promise<T | undefined> {
    try {
      // Get the global variable
      const globalVariable = await this.globalModel.findOne({ _id: this.globalIndexNumberToId(key) });

      return globalVariable?.value as T;
    } catch (error) {
      logError(`Global variable ${key}: ${error} is undefined`);
      return undefined;
    }
  }
}
