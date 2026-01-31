import { ApiProperty, ApiPropertyOptional, getSchemaPath } from "@nestjs/swagger";
import { ArgumentType } from "../debate.schema";
import { ArgumentVoteEnum } from "../debate.types";

export class DebateArgumentDto {
  @ApiProperty({ description: "Unique identifier of the debate argument", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  _id: string;

  @ApiProperty({ description: "ID of the linked proposition", example: "64f1c2e9d8b5a1f2c3d4e5f7" })
  proposition: string;

  @ApiProperty({ description: "Short title or summary of the argument", example: "Reduce traffic congestion" })
  title: string;

  @ApiProperty({ description: "ID of the parent argument, if any", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  parent?: string;

  @ApiProperty({ description: "Full text content of the argument", example: "By improving public transport..." })
  text: string;

  @ApiProperty({ enum: ArgumentType, description: "Argument type (PRO / CON)" })
  type: ArgumentType;

  @ApiProperty({
    description: "List of reaction IDs linked to this argument",
    type: [String],
    example: ["64f1c2e9d8b5a1f2c3d4e5f8"]
  })
  reactions: string[];

  @ApiPropertyOptional({
    enum: ArgumentVoteEnum,
    description: "The vote cast by the current user, if any",
    example: ArgumentVoteEnum.UP,
    nullable: true
  })
  userVoted?: ArgumentVoteEnum;

  @ApiProperty({ description: "Number of votes received by this argument", example: 128 })
  votesCount: number;
}

export class DebateArgumentListDto {
  @ApiProperty({
    description: "Dictionary of all arguments keyed by their ID",
    additionalProperties: { $ref: getSchemaPath(DebateArgumentDto) },
    example: {
      "64f1c2e9d8b5a1f2c3d4e5f6": {
        _id: "64f1c2e9d8b5a1f2c3d4e5f6",
        proposition: "64f1c2e9d8b5a1f2c3d4e5f7",
        title: "Reduce traffic congestion",
        text: "By improving public transport...",
        type: "FOR",
        reactions: ["64f1c2e9d8b5a1f2c3d4e5f8"],
        votesCount: 128
      }
    }
  })
  all: Record<string, DebateArgumentDto>;

  @ApiProperty({
    description: "List of argument IDs supporting the proposition (PRO)",
    type: [String],
    example: ["64f1c2e9d8b5a1f2c3d4e5f6"]
  })
  for: string[];

  @ApiProperty({
    description: "List of argument IDs opposing the proposition (CON)",
    type: [String],
    example: ["64f1c2e9d8b5a1f2c3d4e5f9"]
  })
  against: string[];
}

export class DebateArgumentVoteDto {
  @ApiProperty({ enum: ArgumentVoteEnum, description: "Vote for the argument", example: ArgumentVoteEnum.UP })
  vote: ArgumentVoteEnum;
}
