import { ApiProperty, getSchemaPath } from "@nestjs/swagger";
import { DecisionSummaryDto } from "./decision.dto";

export class SearchDecisionsResponseDto {
  @ApiProperty({
    type: "array",
    items: {
      $ref: getSchemaPath(DecisionSummaryDto)
    }
  })
  decisions: DecisionSummaryDto[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Cursor to be used to fetch next results (if any)"
  })
  nextAfter: string | null;
}
