import { ApiProperty } from "@nestjs/swagger";
import { ArgumentType } from "../debate.schema";

export class ArgumentsSummaryDto {
  @ApiProperty({
    description: "Proposition (subject) text this argument set refers to",
    example: "Improve public transport coverage"
  })
  proposition: string;

  @ApiProperty({ enum: ArgumentType, description: "Type of argument grouping (e.g., PRO / CON)" })
  type: ArgumentType;
}

export class ArgumentDto {
  @ApiProperty({ description: "Unique identifier of the argument", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  _id: string;

  @ApiProperty({
    description: "Proposition text this argument belongs to",
    example: "Improve public transport coverage"
  })
  proposition: string;

  @ApiProperty({ description: "Short title or summary of the argument", example: "Reduce traffic congestion" })
  title: string;

  @ApiProperty({ description: "Number of votes received by this argument", example: 128 })
  votesCount: number;

  @ApiProperty({ enum: ArgumentType, description: "Argument type (e.g., PRO / CON)" })
  type: ArgumentType;
}

export class ArgumentDebateSummaryDto {
  @ApiProperty({ description: "Summary identifier object (holds proposition + type)", type: () => ArgumentsSummaryDto })
  _id: ArgumentsSummaryDto;

  @ApiProperty({ description: "Top arguments ranked by votes", type: () => [ArgumentDto] })
  top_arguments: ArgumentDto[];
}
