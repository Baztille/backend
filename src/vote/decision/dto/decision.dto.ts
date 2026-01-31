import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TerritorySummaryDto } from "src/countrymodel/dto/territory.dto";
import { VotingSessionResultSummaryDto } from "src/vote/voting-session/voting-session.dto";
import { DecisionStatus } from "../types/decision-status.enum";

export class MostVotedPropositionAtNowDto {
  @ApiProperty({ description: "Proposition text" })
  text: string;

  @ApiProperty({ description: "Total number of participants who have voted so far.", example: 100 })
  totalVoters: number;

  @ApiProperty({
    description:
      "Number of votes received by this proposition so far. If 100 has voted and 42 has voted for proposition, this proposition gets 42%",
    example: 42
  })
  votes: number;
}

/**
 * Decision summary = all what is needed to display the summary of a decision in a list
 */

export class DecisionSummaryDto {
  @ApiProperty({ description: "Decision unique identifier" })
  _id: string;

  @ApiProperty({
    enum: DecisionStatus,
    enumName: "DecisionStatus",
    description: "Decision status (subject choice / proposition choice / general vote / decided)",
    example: "SUGGEST_AND_VOTE_SUBJECT"
  })
  status: DecisionStatus;

  @ApiProperty({ description: "Decision root territory ID", example: "000000000000000000000000" })
  territory: TerritorySummaryDto;

  @ApiProperty({ description: "Creation date (timestamp ms)" })
  creationDate: number;

  @ApiPropertyOptional({ description: "Subject selection date (timestamp ms) — deprecated, equals creationDate" })
  subjectSelectionDate?: number; // DEPRECATED: now equals to creationDate

  @ApiPropertyOptional({ description: "Propositions selection date (timestamp ms)" })
  propositionsSelectionDate?: number;

  @ApiProperty({ description: "Decision date (timestamp ms)" })
  decisionDate: number;

  /// Subject selected for this decision
  @ApiProperty({ description: "Selected subject", type: String })
  subject: string;

  @ApiProperty({ description: "Propositions selection voting session ID" })
  propositionsSelectionVotesession: string;

  @ApiProperty({ description: "Number of propositions submitted by users", example: 0 })
  nbrSubmittedPropositions: number;

  //// Decision hotness //////////////////////////

  // Defines how much this decision is popular currently (= many votes from the citizens)

  // Hotness score, computed based on recent voting activity
  @ApiProperty({ description: "Hotness score (based on recent voting activity)", example: 0 })
  hotnessScore: number;

  //// Featured section //////////////////////////

  // Featured date start
  // If set, decision is featured starting this date
  @ApiPropertyOptional({ description: "Featured start date (timestamp ms)" })
  featuredFrom?: number;

  // Featured date end
  // If set, decision is featured until this date
  // Note If not set, decision is featured
  @ApiPropertyOptional({ description: "Featured end date (timestamp ms)" })
  featuredTo?: number;

  //// Decisions taken section //////////////////////////

  @ApiPropertyOptional({ description: "General vote voting session ID (nullable)" })
  generalVoteVotesession?: string;

  @ApiProperty({
    type: Boolean,
    description: "Indicates if the current user has already voted in the general vote of this decision"
  })
  userHasVoted?: boolean = false;

  @ApiProperty({
    type: () => MostVotedPropositionAtNowDto,
    description: "Summary of the general vote results so far (only set uif userHasVoted is true)"
  })
  mostVotedPropositionAtNow?: MostVotedPropositionAtNowDto;
}

/**
 * Sub DTOs
 */

export class DecisionTextDto {
  @ApiProperty({ description: "Proposition/Subject unique identifier" })
  _id: string;

  @ApiProperty({ description: "Text content" })
  text: string;

  @ApiProperty({ description: "Creation date (timestamp ms)" })
  creationDate: number;
}

/**
 * Decision detailed info = all what is needed to display the full decision page
 */
export class DecisionDto extends DecisionSummaryDto {
  @ApiProperty({ type: () => [DecisionTextDto], description: "List of propositions selected for voting" })
  propositions: DecisionTextDto[];

  @ApiProperty({ type: () => [DecisionTextDto], description: "List of propositions submitted by users" })
  submittedPropositions: DecisionTextDto[];

  @ApiPropertyOptional({ type: () => DecisionTextDto, description: "Most voted proposition (when decided)" })
  mostVotedProposition?: DecisionTextDto;

  @ApiProperty({
    description: "Mapping from territory ID to proposition ID (if territory-specific propositions)",
    type: Object,
    example: { "000000000000000000000001": "100000000000000000000001" }
  })
  territoryToProposition: Record<string, string>;

  @ApiProperty({
    type: () => VotingSessionResultSummaryDto,
    description: "Propositions selection voting session results"
  })
  propositionsSelectionVotesessionResults: VotingSessionResultSummaryDto;

  @ApiProperty({
    type: () => VotingSessionResultSummaryDto,
    description: "General vote voting session results"
  })
  generalVoteVotesessionResults: VotingSessionResultSummaryDto;
}
