import {
  Body,
  Controller,
  Get,
  HttpStatus,
  InternalServerErrorException,
  Param,
  Post,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum";
import { RolesGuard } from "src/common/guards/roles.guard";

import { CountrymodelService } from "./countrymodel.service";
import { TerritoryOrganizationUpdateDto } from "./dto/territory-organization-update.dto";
import { TerritoryDto, TerritorySearchResultDto } from "./dto/territory.dto";

@ApiTags("Country model")
@Controller("countrymodel")
export class CountrymodelController {
  constructor(private readonly countrymodelService: CountrymodelService) {}

  @Get("getTerritory/{:territoryId}")
  @ApiOperation({
    operationId: "getTerritory",
    summary: "Returns infos about the given territory (or country if no territory is provided)"
  })
  @ApiParam({
    name: "territoryId",
    required: true,
    description: "ID of the territory to get (if not provided, country info will be returned)",
    example: "000000000000000000000000"
  })
  @ApiOkResponse({
    description: "Territory information",
    type: TerritoryDto
  })
  async getTerritory(@Param("territoryId") territoryId: string) {
    return this.countrymodelService.getTerritory(territoryId);
  }

  /**
   * Search for a city by city name.
   * @summary Search for a city by city name or shortname
   * @param {string} keyword - The keyword to search by.
   * @returns array of corresponding territories
   */
  @Get("city/{:keyword}")
  @ApiOkResponse({
    description: "Array of corresponding territories",
    type: [TerritorySearchResultDto]
  })
  @ApiOperation({
    operationId: "getCity",
    summary: "Search for a city by keyword (73000, Montagnole)",
    description: "Keyword length must be greater than 2"
  })
  @ApiParam({
    name: "keyword",
    required: true,
    description: "Keyword to search by (postal code, city name or shortname)",
    example: "73000"
  })
  async findCity(@Param("keyword") keyword: string) {
    try {
      return await this.countrymodelService.findCity(keyword);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Build "routes to parent territory" (Territory "routeTo" field), for all Polling Stations, from polling stations to the given type
   * @param {string} type - The territory type.
   * @returns true
   */
  @Post("buildRoutes")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "true"
  })
  @ApiOperation({
    operationId: "buildRoutes",
    summary:
      'Build "routes to parent territory" (Territory "routeTo" field), for all Polling Stations, from polling stations to the given type'
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        type: { type: "string", description: "The territory type name to build routes for (ex: 'Country')" }
      },
      required: ["type"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async buildRoutes(@Body() params: { type: string }) {
    return JSON.stringify(await this.countrymodelService.buildRoutes(params.type));
  }

  /**
   * Set Baztille organization on a territory
   * @param {string} territoryId - The territory ID.
   * @param {TerritoryOrganizationMongo} organization - The organization to set on this territory.
   * @returns true
   */
  @Post("setOrganization/:territoryId")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "true"
  })
  @ApiOperation({
    operationId: "setOrganization",
    summary: "Set Baztille organization on a territory"
  })
  @ApiParam({
    name: "territoryId",
    required: true,
    description: "ID of the territory to set the organization on",
    example: "000000000000000000000000"
  })
  @ApiBody({ type: TerritoryOrganizationUpdateDto, description: "Organization to set on this territory" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async setOrganization(
    @Param("territoryId") territoryId: string,
    @Body() organization: TerritoryOrganizationUpdateDto
  ) {
    return JSON.stringify(await this.countrymodelService.setOrganization(territoryId, organization));
  }

  /**
   * Set a territory as votable
   * = we can take decisions for this territory
   * @param {string} territoryId - The territory ID.
   * @returns true
   */
  @Post("setVotable/:territoryId")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "true"
  })
  @ApiOperation({
    operationId: "setVotable",
    summary: "Set a territory as votable = we can take decisions for this territory"
  })
  @ApiParam({
    name: "territoryId",
    required: true,
    description: "ID of the territory to set as votable",
    example: "000000000000000000000000"
  })
  @ApiBearerAuth("JWT-auth")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "true"
  })
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async setVotable(@Param("territoryId") territoryId: string) {
    try {
      return JSON.stringify(await this.countrymodelService.setVotable(territoryId));
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }
}
