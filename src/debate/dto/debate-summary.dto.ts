import { ApiProperty } from "@nestjs/swagger";
import { ArgumentDebateSummaryDto } from "./argument-debate-summary.dto";
import { SubjectContextSummaryDto } from "./subject-context.dto";

export class DebateSummaryDto {
  @ApiProperty({ description: "Current subject context summary for this debate", type: () => SubjectContextSummaryDto })
  subjectContext: SubjectContextSummaryDto;

  @ApiProperty({ description: "Top arguments grouped by proposition and type", type: () => [ArgumentDebateSummaryDto] })
  arguments: ArgumentDebateSummaryDto[];
}
