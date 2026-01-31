import { ApiProperty } from "@nestjs/swagger";
import { IsArray, IsEnum, IsMongoId, IsOptional, IsString } from "class-validator";
import { SubjectTheme } from "../types/subject-theme.enum";

export class CreateSubjectDto {
  @ApiProperty({
    example: "New subject",
    description: "Subject title"
  })
  @IsString()
  title: string;

  // Territory to which the subject applies
  @ApiProperty({
    example: "65ef33e3b4b864cb3838fa30",
    description: "Territory's id"
  })
  @IsMongoId()
  @IsOptional() // Only for backward compatibility, to be removed in the future (Nov 19th, 2025)
  territoryId?: string;

  @ApiProperty({
    example: "65ef33e3b4b864cb3838fa30",
    description: "Theme's id",
    enum: SubjectTheme,
    enumName: "SubjectTheme"
  })
  @IsEnum(SubjectTheme)
  theme: SubjectTheme;

  @ApiProperty({
    example: ["one", "two", "three"],
    description: "Subject's keywords"
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  tags?: string[];
}
