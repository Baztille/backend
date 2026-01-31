import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class EmailsPreferenceDto {
  @ApiProperty({ description: "Email preference name/identifier", example: "weekly_digest" })
  name: string;

  @ApiProperty({ description: "Default value for this email preference", example: true })
  default: boolean;

  @ApiPropertyOptional({ description: "User's specific preference for this email type" })
  userpref?: boolean;

  @ApiProperty({ description: "Whether this email option is currently enabled", example: true })
  option: boolean;
}

export class EmailsPreferencesByCategoryDto {
  @ApiProperty({ description: "Email preference category", example: "Notifications" })
  category: string;

  @ApiProperty({
    type: [EmailsPreferenceDto],
    description: "List of email preferences in this category"
  })
  emails: EmailsPreferenceDto[];
}
