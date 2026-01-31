import { ApiProperty } from "@nestjs/swagger";

export class LinkPastUserDeviceEventsResponseDto {
  @ApiProperty({ description: "Indicates if the operation was successful", example: true })
  success: boolean;

  @ApiProperty({
    description: "Success message",
    example: "Past user/device events processed successfully"
  })
  message: string;
}
