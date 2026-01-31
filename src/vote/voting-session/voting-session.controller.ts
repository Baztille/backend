import { Body, Controller, Get, InternalServerErrorException, Param, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ApiRequest } from "src/authentication/middleware/auth.middleware";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { BallotDto, VotingSessionResultsDto } from "./voting-session.dto";
import { VotingSessionService } from "./voting-session.service";

@ApiTags("Vote")
@Controller("votingSession")
export class VotingSessionController {
  constructor(private readonly votingSessionService: VotingSessionService) {}

  /**
   * Request a voting ballot
   ** Request a ballot for given user, so he/she can vote.
   ** May failed if a ballot has been requested in the latest 12 hours.
   * @param votingSessionId Voting session
   * @param voterSecret string - a random string generated on client side, unique for each voting session, that must be kept on client side.
   * @returns Ballot
   */
  @Post("requestBallot")
  @ApiOperation({
    operationId: "requestBallot",
    summary:
      "Request a voting ballot \
      Request a ballot for given user, so he/she can vote. \
      May failed if a ballot has been requested in the latest 12 hours. \
  "
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        votingSessionId: { type: "string", description: "(Preferred) The ID of the voting session" },
        voterSecret: {
          type: "string",
          description: "(Preferred) A random secret from the voter generated for this voting session"
        }
      },
      required: ["votingSessionId", "voterSecret"]
    }
  })
  @ApiOkResponse({ type: BallotDto })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR, Role.MEMBER)
  async requestBallot(
    @Req() req: ApiRequest,
    @Body() params: { votingSessionId: string; voterSecret: string }
  ): Promise<BallotDto> {
    try {
      const votingSessionId = params.votingSessionId;
      const voterSecret = params.voterSecret;
      return await this.votingSessionService.requestBallot(votingSessionId, req?.user, voterSecret);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   *  Vote
   ** Record users choices on this vote:
   * @param ballot_id string
   * @param voter_secret string - a random string generated on client side, unique for each voting session, that must be kept on client side.
   * @param choices string[] - list of ID of choices of the user (= actual vote)
   */
  @Post("vote")
  @ApiOperation({ operationId: "vote", summary: "Record users choices on this vote" })
  @ApiResponse({ status: 200, description: "Return true if everything went ok." })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        ballotId: { type: "string", description: "The ID of the ballot" },
        voterSecret: {
          type: "string",
          description:
            "A random secret from the voter generated for this voting session (same as the one used to request the ballot)"
        },
        choices: {
          type: "array",
          items: { type: "string" },
          description: "List of IDs of choices of the user (= actual vote)"
        },
        modify: {
          type: "boolean",
          description: "Set to true if you want to modify an existing vote (if allowed by the voting session settings)"
        }
      },
      required: ["ballotId", "voterSecret", "choices"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR, Role.MEMBER)
  async vote(
    @Req() req: ApiRequest,
    @Body() params: { ballotId: string; voterSecret: string; choices: string[]; modify?: boolean }
  ) {
    try {
      return await this.votingSessionService.vote(
        req?.user,
        params.ballotId,
        params.voterSecret,
        params.choices,
        params.modify
      );
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Get voting session results
   * @param votingSessionId string
   * @returns Voting session results
   */
  @Get("getResult/:votingSessionId")
  @ApiOperation({ operationId: "getResult", summary: "Get voting session results" })
  @ApiParam({
    name: "votingSessionId",
    type: String,
    description: "The ID of the voting session to retrieve results for"
  })
  @ApiOkResponse({ description: "Return voting session results.", type: VotingSessionResultsDto })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR, Role.MEMBER)
  async getResult(
    @Req() req: ApiRequest,
    @Param("votingSessionId") votingSessionId: string
  ): Promise<VotingSessionResultsDto> {
    try {
      return await this.votingSessionService.getVotingSession(votingSessionId);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Get voting session auditable datas
   * @param votingSessionId string
   * @returns Voting session auditable datas
   */
  /*
  To be implemented
  
  @Get("getAuditableDatas/:votingSessionId")
  @ApiOperation({ operationId: "getAuditableDatas", summary: "Get voting session auditable datas" })
  @ApiParam({
    name: "votingSessionId",
    type: String,
    description: "The ID of the voting session to retrieve auditable datas for"
  })
  @ApiResponse({ status: 200, description: "Return voting session auditable datas." })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR, Role.MEMBER)
  async getAuditableDatas(@Req() req: ApiRequest, @Param("votingSessionId") votingSessionId: string) {
    try {
      return await this.votingSessionService.getVotingSessionAuditableData(votingSessionId, req?.user);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }*/

  /**
   * Get voting session auditable datas in a downloadable format (temporary URL)
   * @param votingSessionId string
   * @returns temporary URL to download the auditable datas
   */
  /*
  To be implemented

  @Get("getAuditableDatasFile/:votingSessionId")
  @ApiOperation({ operationId: "getAuditableDatasFile", summary: "Get voting session auditable datas file" })
  @ApiParam({
    name: "votingSessionId",
    type: String,
    description: "The ID of the voting session to retrieve auditable datas file for"
  })
  @ApiResponse({ status: 200, description: "Return voting session auditable datas file." })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MODERATOR, Role.MEMBER)
  async getAuditableDatasFile(@Req() req: ApiRequest, @Param("votingSessionId") votingSessionId: string) {
    try {
      return await this.votingSessionService.getVotingSessionAuditableDataFile(votingSessionId, req?.user);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }
    */
}
