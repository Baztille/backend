import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { Language } from "src/countrymodel/types/language.type";
import { CountryDto } from "./country.dto";
import { CountryMongo } from "./country.schema";

@Injectable()
export class CountryService {
  constructor(@InjectModel(CountryMongo.name) private countryModel: Model<CountryMongo>) {}

  /**
   * Find countries by name.
   * @summary Find countries by name
   * @param {Language} language - The language code for localization.
   * @param {string} keyword - The keyword to search by.
   * @returns {Promise<Country[]>} A promise that resolves to an array of countries.
   */
  async findByName(language: Language, keyword: string): Promise<CountryDto[]> {
    const query = {
      [language]: {
        $regex: keyword || "",
        $options: "i"
      }
    };
    return this.countryModel
      .find(query)
      .sort({ [language]: 1 })
      .select(`_id alpha2 ${language}`)
      .exec();
  }
}
