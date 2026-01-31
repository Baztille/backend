import { IsNumber, IsObject, IsOptional, IsString } from "class-validator";

import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TrackEventType } from "src/event/event-types";

export class CreateEventDto {
  @ApiProperty({
    description: "Event type",
    enum: TrackEventType,
    example: "registration"
  })
  @IsString()
  type: TrackEventType;

  @ApiPropertyOptional({ description: "Event data  (flexible object to store event-specific data)" })
  @IsOptional()
  @IsObject()
  eventdata?: any;

  @ApiPropertyOptional({ description: "Event timestamp (optional, defaults to current time)" })
  @IsOptional()
  @IsNumber()
  timestamp?: number;
}
