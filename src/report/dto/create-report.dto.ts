import { ApiProperty } from "@nestjs/swagger";
import { IsMongoId, IsString } from "class-validator";
import { ReportStatus, ReportType } from "src/common/enum";

export class CreateReportDto {
  @ApiProperty({
    example: "65eacd95567eefb7222c3f04",
    description: "ID of the user who is reporting"
  })
  @IsString()
  @IsMongoId()
  reporterId: string;

  @ApiProperty({
    example: ReportType.SUBJECT,
    description: "Type of the report",
    enum: ReportType
  })
  @IsString()
  type: string;

  @ApiProperty({
    example: "ReportMongo description",
    description: "Description of the report"
  })
  @IsString()
  description: string;

  @ApiProperty({
    example: ReportStatus.PENDING,
    description: "Status of the report",
    enum: ReportStatus
  })
  @IsString()
  status: string;

  @ApiProperty({
    example: "5123456789abcdef12345678",
    description: "ID of the target item being reported"
  })
  @IsString()
  targetId: string;
}
