import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags
} from "@nestjs/swagger";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { ApiRequest } from "../authentication/middleware/auth.middleware";
import { DebateArgumentService } from "./debate-argument.service";
import { DebateContextService } from "./debate-context.service";
import { DebateService } from "./debate.service";
import { DebateArgumentDto, DebateArgumentListDto, DebateArgumentVoteDto } from "./dto/argument-debate.dto";
import { ContextPropositionsSortedListDto, ContextPropositionWithUserVoteDto } from "./dto/context-proposition.dto";
import { DebateSummaryDto } from "./dto/debate-summary.dto";

@ApiTags("Debate")
@ApiExtraModels(ContextPropositionsSortedListDto, ContextPropositionWithUserVoteDto)
@Controller("debate")
export class DebateController {
  constructor(
    private readonly debateService: DebateService,
    private readonly debateContextService: DebateContextService,
    private readonly debateArgumentService: DebateArgumentService
  ) {}

  /************** Context & argument summary */

  @Get("summary/:decisionId")
  @ApiOkResponse({
    type: DebateSummaryDto,
    description: "Summary of the debate for a given decisionId"
  })
  @ApiOperation({
    operationId: "getSummary",
    summary: "Get all what is needed to display the summary of the debate for a given decisionId"
  })
  @ApiParam({ name: "decisionId", type: String, description: "The ID of the decision" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.MODERATOR, Role.ADMIN, Role.USER_INCOMPLETE, Role.VISITOR)
  async getDebateSummary(@Param("decisionId") decisionId: string): Promise<DebateSummaryDto> {
    return await this.debateService.getDebateSummary(decisionId);
  }

  /************** Subject context *************/

  @Get("subjectContext/:decisionContextId")
  @ApiOkResponse({
    type: ContextPropositionsSortedListDto,
    description: "List of context text proposed for a given decisionId"
  })
  @ApiOperation({
    operationId: "getSubjectContext",
    summary: "Get list of context text proposed for a given decisionId"
  })
  @ApiParam({
    name: "decisionContextId",
    type: String,
    description: "The ID of the decision context associated to the decision"
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.MODERATOR, Role.ADMIN, Role.USER_INCOMPLETE, Role.VISITOR)
  async getContextTextList(
    @Param("decisionContextId") decisionContextId: string,
    @Req() req: ApiRequest
  ): Promise<ContextPropositionsSortedListDto> {
    return await this.debateContextService.getDebateContextList(decisionContextId, req.user);
  }

  @Post("subjectContext/:decisionContextId/add")
  @ApiOkResponse({
    schema: {
      type: "string"
    },
    description: "New context text added ID"
  })
  @ApiOperation({
    operationId: "addSubjectContext",
    summary: "Add a new context text for a given decisionId"
  })
  @ApiParam({
    name: "decisionContextId",
    type: String,
    description: "The ID of the decision context associated to the decision"
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text of the new context to add" }
      },
      required: ["text"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.MODERATOR, Role.ADMIN)
  async addSubjectContextText(
    @Param("decisionContextId") decisionContextId: string,
    @Body() params,
    @Req() req: ApiRequest
  ) {
    return JSON.stringify(
      await this.debateContextService.addContextProposition(decisionContextId, params.text, req?.user)
    );
  }

  @Post("subjectContext/:decisionContextId/:contextPropositionId/vote")
  @ApiOkResponse({
    type: ContextPropositionsSortedListDto,
    description: "true"
  })
  @ApiOperation({
    operationId: "voteSubjectContext",
    summary: "Vote for a context proposition"
  })
  @ApiParam({
    name: "decisionContextId",
    type: String,
    description: "The ID of the decision context associated to the decision"
  })
  @ApiParam({
    name: "contextPropositionId",
    type: String,
    description: "The ID of the context proposition to vote for"
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.MODERATOR, Role.ADMIN)
  async voteForSubjectContext(
    @Param("decisionContextId") decisionContextId: string,
    @Param("contextPropositionId") contextPropositionId: string,
    @Body() params,
    @Req() req: ApiRequest
  ): Promise<ContextPropositionsSortedListDto> {
    return await this.debateContextService.voteContextProposition(decisionContextId, contextPropositionId, req?.user);
  }

  /********* Arguments on propositions */

  @Get("arguments/:decisionId/:propositionId")
  @ApiOkResponse({
    type: DebateArgumentListDto,
    description: "List of all arguments and sub-arguments for a given decision/proposition"
  })
  @ApiOperation({
    operationId: "getArguments",
    summary: "Get list of all arguments and sub-arguments for a given decision/proposition"
  })
  @ApiParam({ name: "decisionId", type: String, description: "The ID of the decision" })
  @ApiParam({ name: "propositionId", type: String, description: "The ID of the proposition" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.MODERATOR, Role.ADMIN, Role.USER_INCOMPLETE, Role.VISITOR)
  async getArgumentList(
    @Param("decisionId") decisionId: string,
    @Param("propositionId") propositionId: string,
    @Req() req: ApiRequest
  ): Promise<DebateArgumentListDto> {
    return await this.debateArgumentService.getDebateArguments(req?.user, decisionId, propositionId);
  }

  @Post("arguments/:decisionId/:propositionId/add")
  @ApiOkResponse({
    schema: {
      type: "string"
    },
    description: "New argument added ID"
  })
  @ApiOperation({
    operationId: "addArgument",
    summary: "Add a new argument for a given decision/proposition"
  })
  @ApiParam({ name: "decisionId", type: String, description: "The ID of the decision" })
  @ApiParam({ name: "propositionId", type: String, description: "The ID of the proposition" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        parent: { type: "string", description: "(optional) The ID of the parent argument if this is a sub-argument" },
        title: { type: "string", description: "Title of the argument" },
        text: { type: "string", description: "Text of the argument" },
        type: { type: "string", description: "Type of argument", enum: ["FOR", "AGAINST"] }
      },
      required: ["title", "text", "type"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.MODERATOR, Role.ADMIN)
  async addArgument(
    @Param("decisionId") decisionId: string,
    @Param("propositionId") propositionId: string,
    @Body() params,
    @Req() req: ApiRequest
  ) {
    return JSON.stringify(
      await this.debateArgumentService.addArgument(
        decisionId,
        propositionId,
        params.parent,
        params.title,
        params.text,
        params.type,
        req?.user
      )
    );
  }

  @Post("arguments/:argumentId/vote")
  @ApiOkResponse({
    type: DebateArgumentDto,
    description: "true"
  })
  @ApiOperation({
    operationId: "voteArgument",
    summary: "Vote for an argument"
  })
  @ApiParam({ name: "argumentId", type: String, description: "The ID of the argument to vote for" })
  @ApiBody({
    type: DebateArgumentVoteDto
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.MEMBER, Role.MODERATOR, Role.ADMIN)
  async voteForArgument(
    @Param("argumentId") argumentId: string,
    @Body() params,
    @Req() req: ApiRequest
  ): Promise<DebateArgumentDto> {
    return await this.debateArgumentService.voteArgument(argumentId, params.vote, req?.user);
  }
}
