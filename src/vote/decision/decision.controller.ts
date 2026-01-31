import {
  Body,
  Controller,
  Delete,
  Get,
  InternalServerErrorException,
  Param,
  Post,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags
} from "@nestjs/swagger";
import { Roles } from "src/common/decorator/roles.decorator";
import { RolesGuard } from "src/common/guards/roles.guard";

import { ApiRequest } from "src/authentication/middleware/auth.middleware";
import { Role } from "src/common/enum";

import { DecisionService } from "./decision.service";
import { CreateProposalDto } from "./dto/create-proposal.dto";
import { CreateSubjectDto } from "./dto/create-subject.dto";
import { DecisionDto, DecisionSummaryDto } from "./dto/decision.dto";
import { SearchDecisionsResponseDto } from "./dto/search-decisions-response.dto";
import { DecisionStatus } from "./types/decision-status.enum";
import { DecisionsSortBy } from "./types/decisions-filter.type";

@ApiTags("Decision")
@ApiExtraModels(SearchDecisionsResponseDto, DecisionSummaryDto)
@Controller("decision")
export class DecisionController {
  constructor(private readonly decisionService: DecisionService) {}

  /**
   * Controller endpoint to retrieve all decisions.
   * DEPRECATED: use /decision/search instead
   * @returns {Promise<any[]>} An array containing all decisions.
   */
  /*@Get("find")
  @ApiOperation({ operationId: "find", summary: "Get all decisions" })
  @ApiResponse({ status: 200, description: "Return all decisions." })
  @ApiBearerAuth("JWT-auth")
  @ApiQuery({ name: "status", required: false, description: "Filter by decision status", enum: DecisionStatus })
  @ApiQuery({ name: "limit", required: false, description: "Maximum number of decisions to return", type: Number })
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async findDecisions(@Query("status") status: DecisionStatus, @Query("limit") limit: number) {
    try {
      return await this.decisionService.findDecisions({
        status: status,
        limit: limit
      });
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }*/

  /**
   * Controller endpoint to retrieve all decisions matching given filters
   */
  @Get("search")
  @ApiOperation({
    operationId: "search",
    summary: "Get all decisions"
  })
  @ApiOkResponse({ type: SearchDecisionsResponseDto })
  @ApiBearerAuth("JWT-auth")
  @ApiQuery({ name: "status", required: false, description: "Filter by decision status", enum: DecisionStatus })
  @ApiQuery({ name: "limit", required: false, description: "Maximum number of decisions to return", type: Number })
  @ApiQuery({
    name: "featured",
    required: false,
    description: "If true, only featured decisions are returned",
    type: Boolean
  })
  @ApiQuery({
    name: "searchText",
    required: false,
    description: "If set, search decisions matching this text",
    type: String
  })
  @ApiQuery({
    name: "after",
    required: false,
    description: "If set, only decisions after this cursor are returned (for pagination) (base54 format)",
    type: String
  })
  @ApiQuery({
    name: "sortBy",
    required: false,
    description: "Sort order for decisions (default is FEATURED_LOCAL_HOTNESS_DATE)",
    enum: DecisionsSortBy
  })
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR, Role.USER_INCOMPLETE, Role.VISITOR)
  async searchDecisions(
    @Req() req: ApiRequest,
    @Query("status") status: DecisionStatus,
    @Query("limit") limit: number,
    @Query("featured") featured?: boolean,
    @Query("searchText") searchText?: string,
    @Query("after") after?: string,
    @Query("sortBy") sortBy?: DecisionsSortBy
  ): Promise<SearchDecisionsResponseDto> {
    try {
      return await this.decisionService.searchDecisions(
        {
          status: status,
          limit: limit,
          featured: featured,
          searchText: searchText,
          after: after,
          sortBy: sortBy ?? DecisionsSortBy.FEATURED_LOCAL_HOTNESS_DATE
        },
        req.user
      );
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Retrieve all what is needed to display a decision (from decision ID), including all current items that concern vote in progress
   * (all subjects in step 1, all propositions in step 2, 4 propositions in step 3) + current user voting element (ballot number, ...).
   * @param {string} id - The ID of the decision to retrieve.
   * @returns {Promise<DecisionDto>} The decision with the specified ID.
   */
  @Get("get/:id")
  @ApiOperation({ operationId: "get", summary: "Get a decision by ID" })
  @ApiParam({ name: "id", type: String, description: "The ID of the decision to retrieve" })
  @ApiOkResponse({ type: DecisionDto, description: "Return the decision." })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR, Role.USER_INCOMPLETE, Role.VISITOR)
  async getSession(@Param("id") id: string): Promise<DecisionDto> {
    try {
      return await this.decisionService.getDecision(id);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Controller endpoint to delete a decision by its ID.
   * @param {string} id - The ID of the decision to delete.
   * @returns {Promise<any>} The result of the deletion operation.
   */
  @Delete(":id")
  @ApiOperation({ operationId: "delete", summary: "Delete a decision by ID" })
  @ApiParam({ name: "id", type: String, description: "The ID of the decision to delete" })
  @ApiResponse({ status: 204, description: "Decision successfully deleted." })
  @ApiResponse({ status: 404, description: "Decision not found." })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async remove(@Param("id") id: string): Promise<any> {
    try {
      return await this.decisionService.remove(id);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Controller endpoint to retrieve all active decisions for the current user.
   * @returns {Promise<any>} A promise resolving to the current actives decisions.
   *    response member ".general" contains the current general vote in progress (or null if none)
   *    response member ".future" contains the next vote (could be in "choose subject" or "select propositions" state)
   *    In case there is a maintenance in progress (= no possible votes), the response will contain a "maintenance" member set to true.
   *    DEPRECATED: use /decision/search instead
   */
  /*@Get("actives")
  @ApiOperation({ operationId: "getActives", summary: "Get current decisions" })
  @ApiResponse({ status: 200, description: "Return current decisions." })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async getCurrentActiveDecisions() {
    try {
      return await this.decisionService.getCurrentActiveDecisions();
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }*/

  /**
   * Submit a new subject for a given territory
   * @param subject CreateSubjectDto subject to add
   * @returns Ballot
   */
  @Post("submitSubject")
  @ApiOperation({ operationId: "submitSubject", summary: "Submit a new subject for the given territory" })
  @ApiBody({ type: CreateSubjectDto })
  @ApiOkResponse({
    description: "The new decision ID created with this subject",
    schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the newly created decision",
          example: "000000000000000000000000"
        }
      },
      required: ["id"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MEMBER)
  async submitSubject(@Req() req: ApiRequest, @Body() params: CreateSubjectDto): Promise<{ id: string }> {
    try {
      return await this.decisionService.submitSubject(params, req?.user);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Submit a new proposition
   * @param proposal CreateProposalDto proposition to add
   * @returns Ballot
   */
  @Post("submitProposition")
  @ApiOperation({ operationId: "submitProposition", summary: "Submit a new proposition for the given decision" })
  @ApiOkResponse({
    description: "The new proposition ID created for this decision",
    schema: {
      type: "object",
      properties: {
        id: {
          type: "string",
          description: "The ID of the newly created decision",
          example: "000000000000000000000000"
        }
      },
      required: ["id"]
    }
  })
  @ApiBody({ type: CreateProposalDto })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MEMBER)
  async submitProposition(@Req() req: ApiRequest, @Body() params: CreateProposalDto): Promise<{ id: string }> {
    try {
      return await this.decisionService.submitProposition(params, req?.user);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  @Get("hasSubmittedSubject")
  @ApiOperation({
    operationId: "hasSubmittedSubject",
    summary: "Check if current user already submitted a subject in the last 7 days"
  })
  @ApiOkResponse({
    description: "Returns true if user has submitted a subject, false otherwise",
    schema: {
      type: "boolean"
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async hasSubmittedSubject(@Req() req: ApiRequest) {
    try {
      return await this.decisionService.hasSubmittedSubject(req?.user);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  @Get("hasSubmittedProposition/:decisionId")
  @ApiOperation({
    operationId: "hasSubmittedProposition",
    summary: "Check if current user already submitted a proposition for given decision id"
  })
  @ApiParam({ name: "decisionId", type: String, description: "The ID of the decision to check" })
  @ApiOkResponse({
    description: "Returns true if user has submitted a proposition, false otherwise",
    schema: {
      type: "boolean"
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async hasSubmittedProposition(@Param("decisionId") decisionId: string, @Req() req: ApiRequest) {
    try {
      return await this.decisionService.hasSubmittedProposition(req?.user, decisionId);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  @Get("maxVotersRecentDecisions")
  @ApiOperation({
    operationId: "getMaxVotersRecentDecisions",
    summary: "Get the maximum voters number over the 5 last decisions"
  })
  @ApiOkResponse({
    description: "Returns the maximum number of voters over the 5 last decisions",
    schema: {
      type: "number"
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.ADMIN, Role.MODERATOR, Role.USER)
  async maxVotersRecentDecisions() {
    try {
      return await this.decisionService.maxVotersRecentDecisions();
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }
}
