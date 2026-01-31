import { ApiProperty } from "@nestjs/swagger";

export class SubjectContextSummaryDto {
  @ApiProperty({
    description: "Debate context unique identifier",
    example: "64f1c2e9d8b5a1f2c3d4e5f6"
  })
  _id: string;

  @ApiProperty({
    description: "Context text selected at now (context with the most votes + most recent version)",
    example: "This decision aims to improve public transportation in the city center."
  })
  text: string;
}

export class SubjectContextDto extends SubjectContextSummaryDto {
  @ApiProperty({
    description: "Decision ID (one context per decision and vice versa)",
    example: "64f1c2e9d8b5a1f2c3d4e5f7"
  })
  decision: string;

  @ApiProperty({
    description: "ID of the context proposition selected at now",
    example: "64f1c2e9d8b5a1f2c3d4e5f8"
  })
  textId: string;

  @ApiProperty({
    description:
      "Debate end date (timestamp ms) - after this date, no one can vote or submit a new context proposition",
    example: 1672531200000
  })
  debateEndDate: number;
}
