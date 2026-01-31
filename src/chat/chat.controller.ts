import { Body, Controller, Get, HttpStatus, InternalServerErrorException, Post, Req, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { ApiRequest } from "../authentication/middleware/auth.middleware";
import { ChatService } from "./chat.service";
import { LogCurrentUserDto } from "./dto/log-current-user.dto";

@ApiTags("Chat")
@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get("ping")
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiResponse({
    status: HttpStatus.OK,
    description: "Returns chat system generic infos"
  })
  @ApiOperation({
    operationId: "ping",
    summary: "Ping chat system"
  })
  async ping() {
    return JSON.stringify(await this.chatService.ping());
  }

  // DEPRECATED: you should only be authorized to log in as current user on chat system
  /*    @Post('login')
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'Auth token of the logged in user'
    })
    @ApiOperation({
        summary: 'Log a user in the Chat system'
    })
    async login( @Body() params ) {
      return JSON.stringify( await this.chatService.login( params.username, params.password ) );
    }    */

  @Post("logCurrentUser")
  @ApiOkResponse({
    description: "Log current baztille user in the Chat system",
    type: LogCurrentUserDto
  })
  @ApiOperation({
    operationId: "logCurrentUser",
    summary: "Log current baztille user in the Chat system"
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MEMBER, Role.USER)
  async logCurrentUser(@Body() params, @Req() req: ApiRequest): Promise<LogCurrentUserDto> {
    return await this.chatService.logCurrentUser(req?.user);
  }

  @Post("sendAsAdmin")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "true if everything is ok"
  })
  @ApiOperation({
    operationId: "sendAsAdmin",
    summary: "Send message in a room, as admin"
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        room: { type: "string", example: "!eNhoDPjFEkaOmEOCaS:chat.baztille.org" },
        message: { type: "string", example: "Hello, this is an admin message!" }
      },
      required: ["room", "message"]
    }
  })
  async sendAsAdmin(@Body() params: { room: string; message: string }) {
    return await this.chatService.sendAsAdmin(params.room, params.message);
  }

  @Post("sendAdminAnnouncement")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "true if everything is ok"
  })
  @ApiOperation({
    operationId: "sendAdminAnnouncement",
    summary: "Send message to all users in announcement room, eventually with Metadata"
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        message: { type: "string", description: "The announcement message to send" },
        metadata: { type: "object", description: "Optional metadata to include with the announcement" }
      },
      required: ["message"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async sendAdminAnnouncement(@Body() params) {
    return await this.chatService.sendAdminAnnouncement(params.message, params.metadata);
  }

  @Post("sendNotificationToUser")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "true if everything is ok"
  })
  @ApiOperation({
    operationId: "sendNotificationToUser",
    summary: "Send message to a single player in his `my announcements` room, as admin"
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "The ID of the user to send the notification to" },
        message: { type: "string", description: "The notification message to send" },
        metadata: { type: "object", description: "Optional metadata to include with the notification" }
      },
      required: ["userId", "message"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async sendNotificationToUser(@Body() params) {
    return JSON.stringify(
      await this.chatService.sendNotificationToUser(params.userId, params.message, params.metadata)
    );
  }

  @Post("setavatar")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "true if everything is ok"
  })
  @ApiOperation({
    operationId: "setavatar",
    summary: "Set avatar for a given room (Admin only feature, used to set global rooms avatars)"
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        room: { type: "string", description: "The ID of the room to set avatar for" },
        url: { type: "string", description: "The URL of the avatar image to set for the room" }
      },
      required: ["room", "url"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async setRoomAvatar(@Body() params) {
    return await this.chatService.setRoomAvatar(params.room, params.url);
  }

  @Post("testNotif")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "ok"
  })
  @ApiOperation({
    operationId: "testNotif",
    summary:
      "Send a test notification to Firebase (admin only). The content send to Firebase is exactly what is provided in the body of this request"
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async testNotif(@Body() params) {
    return await this.chatService.testNotif(params);
  }

  @Post("updateUserPassword")
  @ApiResponse({
    status: HttpStatus.OK,
    description: "OK"
  })
  @ApiOperation({
    operationId: "updateUserPassword",
    summary: "Renews Matrix password for given user (admin only) & store it to DB"
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        user_id: { type: "string", description: "(DEPRECATED) The ID of the user to update password for" },
        userId: { type: "string", description: "The ID of the user to update password for" }
      },
      required: ["userId"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async updateUserPassword(@Body() params) {
    return await this.chatService.updateUserPassword(params.userId || params.user_id);
  }

  /**
   * Admin function to create a Notification chatroom for each user that does not have one
   * (should not be useful after the first run as all users should have a Notification chatroom created during registration)
   */
  @Post("createNotificationChatroomForAll")
  @ApiOperation({
    operationId: "createNotificationChatroomForAll",
    summary: "Create a Notification chatroom for each user that does not have one (admin only)"
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async createNotificationChatRoomForAllUsers() {
    try {
      return await this.chatService.createNotificationChatRoomForAllUsers();
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /*
    @Get('listRooms')
    @ApiResponse({
        status: HttpStatus.OK,
        description: 'list of rooms'
    })
    @ApiOperation({
        summary: 'Get list of rooms accessible by user'
    })
    @ApiBearerAuth('JWT-auth')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.MEMBER, Role.USER)
    async listRooms( ) {
      return JSON.stringify( await this.chatService.listRooms( ) );
    }  */
}
