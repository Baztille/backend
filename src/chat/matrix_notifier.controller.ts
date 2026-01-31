/* eslint-disable unicorn/filename-case */
import { Body, Controller, HttpStatus, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ChatService } from "./chat.service";

@ApiTags("Chat service")
@Controller("_matrix")
export class MatrixNotifierController {
  constructor(private readonly chatService: ChatService) {}

  @Post("push/v1/notify")
  @ApiBearerAuth("JWT-auth")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "rejected	[string]: A list of all pushkeys given in the notification request that are not valid"
  })
  @ApiOperation({
    operationId: "matrixNotify",
    summary:
      "Input for Matrix notifications (= when Matrix server wants to send a notification to some Baztille user, it is using this endpoint)"
  })
  async matrixNotify(@Body() params) {
    this.chatService.onMatrixNotify(params.notification);
    return { rejected: [] };
  }
}
