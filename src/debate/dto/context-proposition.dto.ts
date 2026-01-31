import { ApiExtraModels, ApiProperty, getSchemaPath } from "@nestjs/swagger";

export class ContextPropositionWithUserVoteDto {
  @ApiProperty({ description: "Unique identifier of the context proposition", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  _id: string;

  @ApiProperty({ description: "Full proposition text", example: "Improve bike lane connectivity across districts." })
  text: string;

  @ApiProperty({ description: "Total number of votes received", example: 128 })
  votesCount: number;

  @ApiProperty({ description: "Whether the current user has voted for this proposition", example: true })
  userVoted: boolean;
}

@ApiExtraModels(ContextPropositionWithUserVoteDto)
export class ContextPropositionsSortedListDto {
  @ApiProperty({
    description: "List of proposition IDs sorted by ranking (best first)",
    type: [String],
    example: ["64f1c2e9d8b5a1f2c3d4e5f6", "64f1c2e9d8b5a1f2c3d4e5f7"]
  })
  sorted: string[];

  @ApiProperty({
    description: "Dictionary of all propositions keyed by their ID",
    type: "object",
    additionalProperties: {
      $ref: getSchemaPath(ContextPropositionWithUserVoteDto)
    },
    example: {
      "64f1c2e9d8b5a1f2c3d4e5f6": {
        _id: "64f1c2e9d8b5a1f2c3d4e5f6",
        text: "Improve bike lane connectivity across districts.",
        votesCount: 128,
        userVoted: true
      }
    }
  })
  all: Record<string, ContextPropositionWithUserVoteDto>;
}
