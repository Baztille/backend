import { ApiProperty } from "@nestjs/swagger";

export class CreateEventResponseDto {
  @ApiProperty({ description: "Indicates if the operation was successful", example: true })
  success: boolean;

  @ApiProperty({ description: "The ID of the created event", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  eventId: string;

  @ApiProperty({ description: "Success message", example: "Event created successfully" })
  message: string;
}
