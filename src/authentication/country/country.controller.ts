import { Controller, Get, InternalServerErrorException, Param } from "@nestjs/common";
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";

import { Language } from "src/countrymodel/types/language.type";
import { CountryDto } from "./country.dto";
import { CountryService } from "./country.service";

@ApiTags("Country")
@Controller("country")
export class CountryController {
  constructor(private readonly countryService: CountryService) {}

  /**
   * Search for a country by name.
   * @summary Search for a country by name
   * @description Available languages are: 'ar' 'bg' 'cs' 'da' 'de' 'el' 'en' 'eo' 'es' 'et' 'eu' 'fa' 'fi' 'fr' 'hr' 'hu' 'hy' 'it' 'ja' 'ko' 'lt' 'nl' 'no' 'pl' 'pt' 'ro' 'ru' 'sk' 'sl' 'sr' 'sv' 'th' 'uk' 'zh' 'zh-tw'
   * Flags can be found at: {{BACKEND_URL}}/asset/flags/{{country.alpha2}}.png (example: http://127.0.0.1:4000/asset/flags/fr.png)
   * @param {Language} language - The language code for localization.
   * @param {string} keyword - The keyword to search by (optional).
   * @returns {void}
   */
  @Get(":language{/:keyword}")
  @ApiOkResponse({
    type: [CountryDto],
    description: "Returns country list"
  })
  @ApiOperation({
    operationId: "findCountryByName",
    summary: "Search for a country by name",
    description: `<b>Available languages are:</b> 'ar' 'bg' 'cs' 'da' 'de' 'el' 'en' 'eo' 'es' 'et' 'eu' 'fa' 'fi' 'fr' 'hr' 'hu' 'hy' 'it' 'ja' 'ko' 'lt' 'nl' 'no' 'pl' 'pt' 'ro' 'ru' 'sk' 'sl' 'sr' 'sv' 'th' 'uk' 'zh' 'zh-tw'
                <br/><b>Flags can be found at:</b> {{BACKEND_URL}}/asset/flags/{{country.alpha2}}.png <i>(example: http://127.0.0.1:4000/asset/flags/fr.png) </i>
                `
  })
  @ApiParam({
    name: "language",
    type: String,
    description: "Language code for country name localization",
    example: "fr"
  })
  @ApiParam({
    name: "keyword",
    type: String,
    description: "Optional keyword to filter countries by name",
    example: "france"
  })
  async findByName(@Param("language") language: Language, @Param("keyword") keyword: string) {
    try {
      return await this.countryService.findByName(language, keyword);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }
}
