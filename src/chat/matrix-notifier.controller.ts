import { Body, Controller, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ChatNotificationService } from "./notification/chat-notification.service";

@ApiTags("Chat service")
@Controller("_matrix")
export class MatrixNotifierController {
  constructor(private readonly chatNotificationService: ChatNotificationService) {}

  @Post("push/v1/notify")
  @ApiBearerAuth("JWT-auth")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "rejected: A list of all pushkeys given in the notification request that are not valid",
    schema: {
      type: "object",
      properties: {
        rejected: {
          type: "array",
          items: { type: "string" },
          description: "List of invalid pushkeys that should be removed"
        }
      }
    }
  })
  @ApiOperation({
    operationId: "matrixNotify",
    summary:
      "Input for Matrix notifications (= when Matrix server wants to send a notification to some Baztille user, it is using this endpoint). Returns rejected pushkeys according to Matrix Push Gateway API spec."
  })
  async matrixNotify(@Body() params): Promise<{ rejected: string[] }> {
    return await this.chatNotificationService.processMatrixNotification(params.notification);
  }
}
