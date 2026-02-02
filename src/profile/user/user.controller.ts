import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpStatus,
  InternalServerErrorException,
  Param,
  Patch,
  Post,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiBody, ApiOkResponse, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { ApiRequest } from "src/authentication/middleware/auth.middleware";
import { FileUploadService } from "src/common/common-services/file-upload.service";
import { Roles } from "src/common/decorator/roles.decorator";
import { Role } from "src/common/enum";
import { RolesGuard } from "src/common/guards/roles.guard";
import { logInfo } from "src/utils/logger";
import { CreateUserDto } from "./dto/create-user.dto";
import { RecruitDto } from "./dto/recruit.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserPrivateViewDto } from "./dto/user-private-view.dto";
import { UserPublicViewDto } from "./dto/user-public-view.dto";
import { AppStoreType, SocialNetworkType, UserDeviceMongo } from "./user.schema";
import { UserService } from "./user.service";

@ApiTags("User")
@Controller("user")
export class UserController {
  constructor(private readonly userService: UserService, private fileUploadService: FileUploadService) {}

  /**
   * Create a new user.
   * @summary Create new user
   * @param {CreateUserDto} createUserDto - The data to create the user with.
   * @returns {void}
   */
  @Post()
  @ApiOperation({ operationId: "create", summary: "Create a new user" })
  @ApiOkResponse({ type: UserPrivateViewDto })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: "Email address already exists."
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @ApiBody({ type: CreateUserDto })
  @Roles(Role.VISITOR, Role.USER_INCOMPLETE, Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async create(@Body() createUserDto: CreateUserDto, @Req() req: ApiRequest) {
    const requestingUser = req?.user;
    return await this.userService.create(createUserDto, requestingUser?.role == Role.ADMIN);
  }

  /**
   * Find a user by ID.
   * Note: you can only get your own user data unless you are ADMIN
   * @summary Find a user by ID
   * @param {string} id - The ID of the user to find.
   * @returns {void}
   */
  @Get("id/:userId")
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER_INCOMPLETE, Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  @ApiOperation({ operationId: "getById", summary: "Get an user by id" })
  @ApiParam({ name: "userId", required: true, description: "ID of the user to retrieve" })
  @ApiOkResponse({ type: UserPrivateViewDto })
  async getUserById(@Param("userId") userId: string, @Req() req: ApiRequest) {
    try {
      const requestedUserId = userId;
      const requestingUser = req?.user;
      if (requestingUser?.role !== Role.ADMIN && requestedUserId !== requestingUser?._id?.toString()) {
        throw new ForbiddenException("You do not have access to this resource");
      }
      const user = await this.userService.getUserPrivateById(userId);
      return user;
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Find a user by email.
   * Note: you can only get your own user data unless you are ADMIN
   * @summary Find a user by email
   * @param {string} email - The email of the user to find.
   * @returns {void}
   */
  @Get("email/:email")
  @ApiOperation({ operationId: "getByEmail", summary: "Get an user by email" })
  @ApiParam({ name: "email", required: true, description: "Email of the user to retrieve" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER_INCOMPLETE, Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  @ApiOkResponse({ type: UserPrivateViewDto })
  async getUserByEmail(@Param("email") email: string, @Req() req: ApiRequest) {
    try {
      const requestedUserEmail = email;
      const requestingUser = req?.user;
      if (requestingUser?.role !== Role.ADMIN && requestedUserEmail !== requestingUser?.email) {
        throw new ForbiddenException("You do not have access to this resource");
      }
      return await this.userService.getUserPrivateByEmail(email);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Retrieve public information of a user by ID.
   * @summary Retrieve public information of a user by ID.
   * @param {string} id - The ID of the user to find.
   * @returns {void}
   */
  @Get("public/:userId")
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  @ApiOperation({ operationId: "getPublicInfos", summary: "Get an user by id" })
  @ApiParam({ name: "userId", required: true, description: "ID of the user to retrieve" })
  @ApiOkResponse({ type: UserPublicViewDto })
  async getPublicInfos(@Param("userId") userId: string, @Req() req: ApiRequest): Promise<UserPublicViewDto> {
    try {
      const user = await this.userService.getUserPublicById(userId);
      return user;
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Update a user by email.
   * Note: you can only update your own user data unless you are ADMIN
   * @summary Update a user by email
   * @param {string} email - The email of the user to update.
   * @param {UpdateUserDto} updateUserDto - The data to update the user with.
   * @returns {void}
   */
  @Patch(":email")
  @ApiOperation({ operationId: "update", summary: "Update an user by email" })
  @ApiParam({ name: "email", required: true, description: "Email of the user to update" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER_INCOMPLETE, Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  @ApiOkResponse({ type: UserPrivateViewDto })
  async update(@Param("email") email: string, @Body() updateUserDto: UpdateUserDto, @Req() req: ApiRequest) {
    try {
      const requestedUserEmail = email;
      const requestingUser = req?.user;
      if (requestingUser?.role !== Role.ADMIN && requestedUserEmail !== requestingUser?.email) {
        throw new ForbiddenException("You do not have access to this resource");
      }
      return await this.userService.updateUser(email, updateUserDto);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Update user device information
   * @summary Update user device informations
   * @param {string} email - The email of the user to update.
   * @param deviceInfos - The data to update the user's device with.
   * @returns {void}
   */
  @Patch("device/:email")
  @ApiOperation({ operationId: "updateDevice", summary: "Update user device info by email" })
  @ApiParam({ name: "email", required: true, description: "Email of the user to update" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR, Role.USER_INCOMPLETE)
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        deviceInfos: { type: "object" },
        newSession: {
          type: "boolean",
          example: true,
          description: "Set to true if this is a new session (to update lastsession field)"
        }
      },
      required: ["deviceInfos"]
    }
  })
  @ApiOkResponse({ type: UserPrivateViewDto })
  async updateDevice(
    @Param("email") email: string,
    @Body() postData: { deviceInfos: UserDeviceMongo; newSession?: boolean },
    @Req() req: ApiRequest
  ) {
    try {
      logInfo("Updating device");
      const requestedUserEmail = email;
      const requestingUser = req?.user;
      if (requestingUser?.role !== Role.ADMIN && requestedUserEmail !== requestingUser?.email) {
        throw new ForbiddenException("You do not have access to this resource");
      }
      return await this.userService.updateDevice(email, postData?.deviceInfos, postData?.newSession ?? false);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Remove a user by ID.
   * @summary Remove a user by ID
   * @param {string} id - The ID of the user to remove.
   * @returns {void}
   */
  /*
  @Delete(':userId')
  @ApiOperation({ summary: 'Delete an user by ID' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async remove(@Param('userId') userId: string, @Req() req: ApiRequest) : Promise<any> {
    try {
      const requestedUserId = userId;
      const requestingUser = req?.user;
      if (requestingUser?.role !== Role.ADMIN && requestedUserId !== requestingUser?._id?.toString()) {
        throw new ForbiddenException("You do not have access to this resource");
      }
      return await this.userService.remove(userId);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }*/

  /**
   * Send a test email to given user
   * @summary Send a test email to given user
   * @param {string} id - The ID of the user.
   * @returns {void}
   */
  @Post("testEmail/:userId")
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  @ApiOperation({ operationId: "testEmail", summary: "Send a test email to given user" })
  @ApiParam({ name: "userId", required: true, description: "ID of the user to send test email" })
  @ApiResponse({ status: HttpStatus.OK, description: "Test email sent successfully" })
  async testEmail(@Param("userId") userId: string, @Req() req: ApiRequest) {
    try {
      const requestedUserId = userId;
      const requestingUser = req?.user;
      if (requestingUser?.role !== Role.ADMIN && requestedUserId !== requestingUser?._id?.toString()) {
        throw new ForbiddenException("You do not have access to this resource");
      }
      await this.userService.testEmail(userId);
      return;
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * The `removeAll` function calls the `removeAll` method of the `userService` object.
   * @returns The `removeAll()` method is returning the result of calling the `removeAll()` method on
   * the `userService` object.
   */
  /* Too dangerous method to be exposed */
  /*
  @Delete()
  @ApiOperation({ summary: 'Delete all users' })
  @ApiResponse({ status: 200, description: 'All user has been deleted successfully.' })
  @ApiResponse({ status: 404, description: 'All user does not exist.' })
  @ApiBearerAuth('JWT-auth')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async removeAll() : Promise<any> {
    try {
      return await this.userService.removeAll();
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }*/

  /**
   * Retrive all recruits (referrals) for a given user ID.
   * @summary Retrieve all recruits (referrals) for a given user ID
   * @param {string} userId - The `userId` parameter is a string that represents the unique identifier
   * of a user. It is used to retrieve referrals for the specified user from the `userService`.
   * @returns all what is needed to display the recruits list on app side
   */
  @Get("recruits/:userId")
  @ApiOperation({ operationId: "getRecruits", summary: "Get all recruits by user id" })
  @ApiParam({ name: "userId", required: true, description: "ID of the user to retrieve recruits" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  @ApiOkResponse({ type: [RecruitDto] })
  async getRecruits(@Param("userId") userId: string, @Req() req: ApiRequest) {
    try {
      const requestedUserId = userId;
      const requestingUser = req?.user;
      if (requestingUser?.role !== Role.ADMIN && requestedUserId !== requestingUser?._id?.toString()) {
        throw new ForbiddenException("You do not have access to this resource");
      }
      return await this.userService.getRecruits(userId);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Admin function to create a mentor ID for all users that do not have one
   * (should not be useful after the first run as all users should have a mentor ID during registration)
   */
  @Post("generateMentorInvitationCodeForAll")
  @ApiOperation({
    operationId: "generateMentorInvitationCodeForAll",
    summary: "Generate mentor invitation code for all users without one"
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async generateMentorInvitationCodeForAll() {
    try {
      return await this.userService.generateMentorInvitationCodeForAllUsers();
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Mark a social network as "joined" for current user.
   * @summary Mark a social network as "joined" for current user
   * @param {string} socialNetwork - The name of the social network to mark as joined.
   * @returns {void}
   */
  @Post("socialNetworkJoined/:socialNetwork")
  @ApiOperation({ operationId: "socialNetworkJoined", summary: 'Mark a social network as "joined" for current user' })
  @ApiParam({
    name: "socialNetwork",
    type: String,
    description: "The name of the social network to mark as joined (facebook, linkedin, instagram, bluesky, discord)",
    enum: ["facebook", "linkedin", "instagram", "bluesky", "discord"]
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async markSocialNetworkJoined(@Param("socialNetwork") socialNetwork: SocialNetworkType, @Req() req: ApiRequest) {
    try {
      const requestingUser = req?.user;
      return await this.userService.markSocialNetworkJoined(requestingUser._id.toString(), socialNetwork);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /**
   * Mark that use has rated app on some app store
   * @summary Mark a social network as "joined" for current user
   * @param {string} store - The name of the store where user rated the app (ios / android)
   * @returns {void}
   */
  @Post("ratedApp/:store")
  @ApiOperation({ operationId: "ratedApp", summary: "Mark that user has rated app on some app store" })
  @ApiParam({
    name: "store",
    type: String,
    description: "The app store where user rated the app",
    enum: ["ios", "android"]
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async markAppRated(@Param("store") store: AppStoreType, @Req() req: ApiRequest) {
    try {
      const requestingUser = req?.user;
      return await this.userService.markAppStoreReview(requestingUser._id.toString(), store);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /** Update user avatar
   * @summary Update user avatar
   * @param {string} userId - The ID of the user whose avatar is being updated.
   */
  @Post("updateAvatar/:userId")
  @ApiOperation({ operationId: "updateAvatar", summary: "Update user avatar" })
  @ApiParam({
    name: "userId",
    required: true,
    description: "ID of the user to update avatar",
    example: "11000000020103000000000000"
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        avatar: { type: "string", description: "Avatar image data ID" }
      },
      required: ["avatar"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async updateAvatar(@Param("userId") userId: string, @Body() params: { avatar: string }, @Req() req: ApiRequest) {
    try {
      const requestingUser = req?.user;
      if (requestingUser?.role !== Role.ADMIN && userId !== requestingUser?._id?.toString()) {
        throw new ForbiddenException("You do not have access to this resource");
      }

      return await this.userService.updateAvatar(userId, params.avatar);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /** Validate a mentorInvitationCode
   *  @summary Validate a mentorInvitationCode
   *  @param {string} mentorInvitationCode - The mentor invitation code to validate.
   *  @returns {boolean} - Returns true if the mentor invitation code is valid, false otherwise.
   */
  @Get("validateMentorInvitationCode/:mentorInvitationCode")
  @ApiOperation({
    operationId: "validateMentorInvitationCode",
    summary: "Validate a mentor invitation code"
  })
  @ApiParam({
    name: "mentorInvitationCode",
    required: true,
    description: "Mentor invitation code to validate",
    example: "ABCD1234"
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.VISITOR, Role.USER_INCOMPLETE, Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  @ApiOkResponse({
    type: Boolean,
    description: "Returns true if the mentor invitation code is valid, false otherwise."
  })
  async validateMentorInvitationCode(
    @Param("mentorInvitationCode") mentorInvitationCode: string,
    @Req() req: ApiRequest
  ): Promise<boolean> {
    try {
      return await this.userService.validateMentorInvitationCode(mentorInvitationCode);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /** User ask for its account removal
   * @summary User ask for its account removal (this will send a confirmation code by email)
   * @param {string} userId - The ID of the user whose account is being removed.
   * @returns {void}
   */
  @Post("removeAccount/:userId")
  @ApiOperation({ operationId: "removeAccount", summary: "User ask for its account removal" })
  @ApiParam({ name: "userId", required: true, description: "ID of the user to remove account" })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER_INCOMPLETE, Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async removeAccount(@Param("userId") userId: string, @Req() req: ApiRequest) {
    try {
      const requestingUser = req?.user;
      if (requestingUser?.role !== Role.ADMIN && userId !== requestingUser?._id?.toString()) {
        throw new ForbiddenException("You do not have access to this resource");
      }

      return await this.userService.removeAccount(userId);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /** User confirm account removal using code sent by email
   * @summary User confirm account removal using code sent by email
   * @param {string} userId - The ID of the user whose account is being removed.
   * @param {string} code - The code sent by email to confirm account removal.
   * @returns {void}
   */
  @Post("removeAccountConfirm")
  @ApiOperation({
    operationId: "removeAccountConfirm",
    summary: "User confirm account removal using code sent by email"
  })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        userId: { type: "string", description: "ID of the user to remove account" },
        code: { type: "string", description: "Code sent by email to confirm account removal" }
      },
      required: ["userId", "code"]
    }
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.USER_INCOMPLETE, Role.USER, Role.MEMBER, Role.ADMIN, Role.MODERATOR)
  async confirmRemoveAccount(@Body() params: { userId: string; code: string }, @Req() req: ApiRequest) {
    try {
      const requestingUser = req?.user;
      if (requestingUser?.role !== Role.ADMIN && params.userId !== requestingUser?._id?.toString()) {
        throw new ForbiddenException("You do not have access to this resource");
      }

      return await this.userService.confirmRemoveAccount(params.userId, params.code, req?.user);
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }

  /** Admin function to create missing field for all users that don't have it
   * (should not be useful after the first run as all users should have this field created during registration)
   */
  @Post("generateMissingFieldsForAll")
  @ApiOperation({
    operationId: "generateMissingFieldsForAll",
    summary: "Generate missing fields for all users without one"
  })
  @ApiBearerAuth("JWT-auth")
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async generateMissingFieldsForAll() {
    try {
      return await this.userService.createMissingFieldsForAllUsers();
    } catch (error) {
      throw new InternalServerErrorException(error?.message);
    }
  }
}
