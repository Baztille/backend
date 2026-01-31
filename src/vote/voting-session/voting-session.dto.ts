import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { DecisionStatus } from "../decision/types/decision-status.enum";
import { VotingSessionAvailability } from "./voting-session.schema";

export class BallotDto {
  @ApiProperty({ description: "Ballot unique identifier", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  _id: string;

  @ApiProperty({ description: "Ballot number", example: 12345 })
  no: number;

  @ApiProperty({ description: "Whether this ballot has been used", example: false })
  used: boolean;

  @ApiProperty({ description: "Timestamp (ms) until which the ballot is valid", example: 1672531199000 })
  validUntil: number;

  @ApiProperty({ description: "Polling station ID where ballot is valid", example: "64f1c2e9d8b5a1f2c3d4e5f7" })
  pollingStationId: string;

  @ApiProperty({ description: "Ballot box ID where ballot should be submitted", example: "64f1c2e9d8b5a1f2c3d4e5f8" })
  ballotBoxId: string;

  @ApiProperty({ description: "Voting session ID this ballot belongs to", example: "64f1c2e9d8b5a1f2c3d4e5f9" })
  votingSessionId: string;

  @ApiPropertyOptional({ description: "Choices selected by the voter", example: ["Choice A", "Choice B"] })
  choices?: string[];
}

export class VotingSessionDto {
  @ApiProperty({ description: "Voting session unique identifier", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  _id: string;

  @ApiProperty({
    enum: DecisionStatus,
    description: "Type of voting session (decision status phase)",
    example: DecisionStatus.SUGGEST_AND_VOTE_SUBJECT
  })
  type: DecisionStatus;

  @ApiProperty({ description: "Start time of the voting session (timestamp ms)", example: 1672444800000 })
  startTime: number;

  @ApiPropertyOptional({
    description: "End time of the voting session (timestamp ms, null if ongoing)",
    example: 1672531200000
  })
  endTime: number | null;

  @ApiProperty({
    description: "Territory ID where this voting session takes place",
    example: "64f1c2e9d8b5a1f2c3d4e5f7"
  })
  territory: string;

  @ApiProperty({
    type: Object,
    description: "Map of choice ID to vote count",
    example: { choice1: 150, choice2: 200 }
  })
  votesSum: Map<string, number>;

  @ApiProperty({ description: "Total number of voters who participated", example: 350 })
  votersCount: number;

  @ApiProperty({
    enum: VotingSessionAvailability,
    description: "Current availability status of the voting session"
  })
  status: VotingSessionAvailability;

  @ApiProperty({
    type: [String],
    description: "List of available choices in this voting session",
    example: ["Choice A", "Choice B", "Choice C"]
  })
  choices: string[];

  @ApiProperty({
    type: Object,
    description: "Map of choice ID to tiebreaker value",
    example: { choice1: 0, choice2: 1 }
  })
  choiceTiebreaker: Map<string, number>;

  @ApiProperty({
    description: "Maximum number of choices a voter can select",
    example: 1
  })
  maxChoices: number;
}

export class VotingSessionResultSummaryDto {
  @ApiProperty({ description: "Number of voters who participated", example: 100 })
  votersCount: number;

  @ApiProperty({
    type: () => [VotingSessionChoiceResultDto],
    description: "Results for each choice in the voting session"
  })
  results: VotingSessionChoiceResultDto[];
}

export class VotingSessionChoiceResultDto {
  @ApiProperty({ description: "Choice identifier or text" })
  choice: string;

  @ApiProperty({ description: "Number of votes received", example: 42 })
  votes: number;

  @ApiProperty({ description: "Tiebreaker value for ordering in case of equal votes", example: 0 })
  tiebreaker: number;
}

export class VotingSessionResultsDto {
  @ApiProperty({
    type: () => VotingSessionDto,
    description: "Voting session details and aggregated results"
  })
  votingSession: VotingSessionDto;

  @ApiProperty({
    type: Object,
    description: "Hierarchical tree structure of ballot boxes with their vote counts"
  })
  ballotBoxesTree: any; // TODO: Create proper DTO for ballot box tree structure
}
