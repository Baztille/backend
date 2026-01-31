import { Body, Controller, InternalServerErrorException, Post, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum/role.enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { logError } from "src/utils/logger";
import { CreateEventResponseDto } from "./dto/create-event-response.dto";
import { CreateEventDto } from "./dto/create-event.dto";
import { LinkPastUserDeviceEventsResponseDto } from "./dto/link-past-user-device-events-response.dto";
import { EventService } from "./event.service";

@ApiTags("Event")
@Controller("event")
export class EventController {
  constructor(private readonly eventService: EventService) {}

  /**
   * Record a new tracking event (external API)
   * @param req Request object
   * @param createEventDto Event data
   * @returns Created event
   */
  @Post()
  @ApiOperation({
    operationId: "createEvent",
    summary: "Create a new event",
    description: "Capture events from external sources"
  })
  @ApiBody({ type: CreateEventDto })
  @ApiResponse({ status: 201, description: "Event created successfully.", type: CreateEventResponseDto })
  @ApiResponse({ status: 400, description: "Bad request." })
  async createEvent(@Body() createEventDto: CreateEventDto): Promise<CreateEventResponseDto> {
    try {
      const event = await this.eventService.trackExternalEvent(createEventDto);
      return {
        success: true,
        eventId: event._id.toString(),
        message: "Event created successfully"
      };
    } catch (error) {
      logError(`Failed to create event via API: ${error.message}`, error);
      throw new InternalServerErrorException(error?.message || "Failed to create event");
    }
  }

  /**
   * Admin endpoint to transform all past create_user/user_login events to link devices to users records
   * (to be used after deploying the user/device linking feature, to retroactively link past events)
   * Should not be useful after the cronjob is in place (=> to be removed later)
   */
  @Post("admin/linkPastUserDeviceEvents")
  @ApiOperation({
    operationId: "linkPastUserDeviceEvents",
    summary: "Admin: Link past user/device events",
    description: "Transform all past create_user/user_login events to link devices to users records"
  })
  @ApiResponse({
    status: 200,
    description: "Past user/device events processed successfully.",
    type: LinkPastUserDeviceEventsResponseDto
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard) // Add appropriate admin guard here
  @Roles(Role.ADMIN)
  async linkPastUserDeviceEvents(): Promise<LinkPastUserDeviceEventsResponseDto> {
    try {
      await this.eventService.linkPastUserDeviceEvents();
      return {
        success: true,
        message: "Past user/device events processed successfully"
      };
    } catch (error) {
      logError(`Failed to link past user/device events: ${error.message}`, error);
      throw new InternalServerErrorException(error?.message || "Failed to link past user/device events");
    }
  }
}
