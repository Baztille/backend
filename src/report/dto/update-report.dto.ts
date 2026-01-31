import { ApiProperty, PartialType } from "@nestjs/swagger";
import { IsMongoId } from "class-validator";
import { CreateReportDto } from "./create-report.dto";

export class UpdateReportDto extends PartialType(CreateReportDto) {
  @ApiProperty({
    example: "65e9fe779ad1a40e5cd969f2",
    description: "ReportMongo id (unique)"
  })
  @IsMongoId()
  readonly _id: string;
}
