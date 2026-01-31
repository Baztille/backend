import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ApiRequest } from "src/authentication/middleware/auth.middleware";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum/role.enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { TestVoteAction, TestVoteService } from "./testvote.service";

@ApiTags("Test vote session")
@Controller("testvote")
export class TestVoteController {
  constructor(private readonly testVoteService: TestVoteService) {}

  @Get("voteTest/:action{/:id}")
  @ApiOperation({
    operationId: "voteTest",
    summary:
      "Trigger a fake vote action to test vote cycle (for dev purpose only). Possible actions: \
      submit_subjects: Submit subjects (vote step 1) \
      submit_propositions: Submit propositions (vote step 2) \
      vote_subjects: Vote for random subjects (vote step 1) \
      vote_propositions: Vote for random propositions (vote step 2) \
      vote_general: Vote for random selectedpropositions (vote step 3) \
      Unit testing vote session:\
      votesession_create: create vote session\
      votesession_ballot_request: create vote session\
      votesession_vote: vote on vote session\
      votesession_mass_vote: mass vote on vote session\
      votesession_close: create vote session\
  "
  })
  @ApiParam({
    name: "action",
    type: String,
    description: "The action to trigger",
    enum: [
      "submit_subjects",
      "submit_propositions",
      "vote_subjects",
      "vote_propositions",
      "vote_general",
      "votesession_create",
      "votesession_ballot_request",
      "votesession_vote",
      "votesession_mass_vote",
      "votesession_close"
    ]
  })
  @ApiParam({
    name: "id",
    type: String,
    description: "(optional) The ID of the test voting session to use for votesession_* actions",
    required: true
  })
  @ApiResponse({ status: 200, description: "Return ok if everything went ok." })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async voteTest(@Param("action") action: TestVoteAction, @Req() req: ApiRequest, @Param("id") id: string) {
    //  try {
    return await this.testVoteService.voteTest(action, req?.user, id);
    // } catch (error) {
    // throw new InternalServerErrorException(error?.message);
    // }
  }
}
