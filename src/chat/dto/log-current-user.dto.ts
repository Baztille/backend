import { ApiProperty } from "@nestjs/swagger";

export class ChatRoomDto {
  @ApiProperty({ description: "Chat room unique identifier", example: "!abc123:chat.example.org" })
  id: string;

  @ApiProperty({ description: "Comment or description for the chat room" })
  comment: string;
}

export class LogCurrentUserDto {
  @ApiProperty({
    type: [ChatRoomDto],
    description: "List of default chat rooms for the user"
  })
  defaultRooms: ChatRoomDto[];

  @ApiProperty({ description: "Matrix access token for the current user" })
  accessToken: string;
}
