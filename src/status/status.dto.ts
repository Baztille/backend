import { ApiProperty } from "@nestjs/swagger";

export class MaintenanceStatusDto {
  @ApiProperty({
    description: "Indicates if the votes maintenance message is active",
    example: "The voting system is currently under maintenance. Some features may be unavailable."
  })
  votesMaintenanceMessage: string;

  @ApiProperty({ description: "Indicates if users can currently vote", example: true })
  canVote: boolean;

  @ApiProperty({ description: "Indicates if the vote cycle is active", example: true })
  voteCycle: boolean;
}
