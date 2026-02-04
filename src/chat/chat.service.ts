import { HttpService } from "@nestjs/axios";
import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import sdk from "matrix-js-sdk";
import { Model } from "mongoose";
import { I18nService } from "nestjs-i18n/dist/services/i18n.service";
import { firstValueFrom } from "rxjs";
import { FirebaseService } from "src/common/firebase/firebase.service";
import { logDebug, logError, logInfo } from "src/utils/logger";
import { UserMongo } from "../profile/user/user.schema";
import { BaztilleChatMessageMedata } from "./chat.schema";

import * as crypto from "crypto";
import { Role } from "src/common/enum/role.enum";
import { User } from "src/profile/user/types/user.type";
import { DefaultChatRoom } from "./chat.type";
import { LogCurrentUserDto } from "./dto/log-current-user.dto";

export enum MatrixClientType {
  MATRIX_CLIENT_ADMIN = "MATRIX_CLIENT_ADMIN",
  MATRIX_CLIENT_USER = "MATRIX_CLIENT_USER",
  MATRIX_CLIENT_UNLOGGED = "MATRIX_CLIENT_UNLOGGED"
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(UserMongo.name) private readonly userModel: Model<UserMongo>,
    private readonly httpService: HttpService,
    private readonly firebaseService: FirebaseService,
    private readonly i18n: I18nService
  ) {}

  // This client is identified as the backend, as Matrix admin
  private adminMatrixClient: sdk.MatrixClient | null = null;

  /**
   * Ping chat system to check if it is online
   * @param
   * @returns basic chat system infos
   */
  async ping() {
    const matrix_client = await this.getMatrixClient(MatrixClientType.MATRIX_CLIENT_ADMIN);

    const versions = await matrix_client.getVersions();

    logInfo(versions);

    return versions;
  }

  /**
   * List rooms accessible by this user
   * DEPRECATED
   * @param
   * @returns list of rooms
   */
  /*    async listRooms() : Promise<any>
    {
      this.initMatrixClient();

      let rooms = await this.matrixClient.getJoinedRooms();

      return rooms;
    }*/

  /**
   * Log a user in the Chat system
   * DEPRECATED: see "logCurrentUser" instead
   * @param username: string username
   * @param password: string password
   * @returns Auth token
   */
  /*    async login( username: string, password: string ) : Promise<any>
    {
      this.initMatrixClient();

      return this.logUserIn( username, password );
    }*/

  /**
   * Log current user in the Chat system
   * Create user account in the Chat system if it does not exists (with a random password)
   * @param currentUser: user current user
   * @returns Auth token
   */
  async logCurrentUser(currentUser: User): Promise<LogCurrentUserDto> {
    const user_matrix_username = currentUser._id; // Note: Matrix users IDs are equal to Baztille users IDs

    logInfo("trying to log current user (" + currentUser.email + ") on chat system");

    const matrix_client = await this.getMatrixClient(MatrixClientType.MATRIX_CLIENT_UNLOGGED);

    const defaultRooms: DefaultChatRoom[] = JSON.parse(process.env.CHAT_SERVICE_DEFAULT_ROOMS ?? "[]");

    // For each (votable) territory linked to this user, add its chatroom to defaultRooms
    currentUser.territoriesInfos.forEach((territory) => {
      if (territory.votableTerritory && territory.votableTerritory.chatroomId) {
        // Check if this room is not already in defaultRooms
        let bFound = false;
        for (const i in defaultRooms) {
          if (defaultRooms[i].id == territory.votableTerritory.chatroomId) {
            bFound = true;
          }
        }
        if (!bFound) {
          defaultRooms.push({
            id: territory.votableTerritory.chatroomId,
            comment: territory.name
          });
        }
      }
    });

    // Do we have a Matrix password stored for this user?
    if (currentUser.matrixSecret) {
      logInfo("We got a matrix password stored for this user => let's use it to login");

      const accessToken = await this.logUserIn(matrix_client, user_matrix_username, currentUser.matrixSecret, true);

      if (accessToken == "") {
        throw new Error("Error during Matrix loging of user " + currentUser.email);
      }

      return {
        defaultRooms: defaultRooms,
        accessToken: accessToken
      };
    }

    // If we do not have a password or password does not work, let's register this user
    logInfo("Did not find any matrix password: let's register a new user");

    // Doc: https://element-hq.github.io/synapse/latest/admin_api/register_api.html

    // Get the nonce

    const pre_registration = await this.chatRawApiGet("/_synapse/admin/v1/register");

    if (!pre_registration.nonce) {
      throw new Error("Failed to get the nonce");
    }

    logInfo("Nonce = ", pre_registration.nonce);

    // Create a new password for this user
    const user_matrix_password = crypto.randomUUID();

    // Save this password in DB before doing anything else
    currentUser.matrixSecret = user_matrix_password;
    await this.userModel.updateOne(
      { _id: currentUser._id },
      {
        $set: {
          matrixSecret: user_matrix_password
        }
      }
    );

    // Build the MAC
    const mac =
      pre_registration.nonce +
      "\u0000" +
      user_matrix_username +
      "\u0000" +
      user_matrix_password +
      "\u0000" +
      "notadmin";
    const shared_secret = process.env.CHAT_SERVICE_REGISTRATION_SECRET;

    if (!shared_secret) {
      throw new Error("CHAT_SERVICE_REGISTRATION_SECRET is not set");
    }

    const mac_hex = crypto
      .createHmac("sha1", shared_secret as string)
      .update(mac)
      .digest("hex");

    // Then, post back to same URL
    const postData = {
      nonce: pre_registration.nonce,
      username: user_matrix_username,
      password: user_matrix_password,
      displayname: "_anonymous_citizen_", // Default string to be recognized by the app and replaced by a localized string
      admin: false,
      mac: mac_hex
    };
    const result = await this.chatRawApiPost<{ access_token: string }>("/_synapse/admin/v1/register", postData);

    if (result && result.access_token) {
      // Success!
      logInfo("Registration is a success! Result = ", result);
      return {
        defaultRooms: defaultRooms,
        accessToken: result.access_token // Note: not camelCase to match synapse API format
      };
    } else {
      logError("Error during registration of user " + currentUser.email);
      throw new Error("Error during Matrix registration of user " + currentUser.email);
    }
  }

  /**
   * Update public name of this user on the Matrix server
   * @param userId: user ID
   * @param publicName: new public name
   * @returns true if everything went well
   */

  async updatePublicName(userId: string, publicName: string) {
    const matrix_client = await this.getMatrixClient(MatrixClientType.MATRIX_CLIENT_ADMIN);

    const accessToken = matrix_client.getAccessToken();

    const matrixUserId = "@" + userId + ":" + process.env.CHAT_SERVICE_SERVERNAME;
    const postData = {
      displayname: publicName
    };
    await this.chatRawApiPut(
      "/_matrix/client/r0/profile/" + matrixUserId + "/displayname?access_token=" + accessToken,
      postData
    );
  }

  /**
   * Change Matrix password for given user
   * @param userId
   * @returns ok
   */
  async updateUserPassword(userId: string): Promise<boolean> {
    logDebug("Resetting password for " + userId);

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new BadRequestException("Cannot find user " + userId);
    }

    const matrix_client = await this.getMatrixClient(MatrixClientType.MATRIX_CLIENT_ADMIN);

    const accessToken = matrix_client.getAccessToken();

    if (!accessToken) {
      throw Error("Invalid access token received for Matrix");
    }

    // Create a new password for this user
    const user_matrix_password = crypto.randomUUID();

    // Save this password in DB before doing anything else
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          matrixSecret: user_matrix_password
        }
      }
    );

    const matrixUserId = "@" + userId + ":" + process.env.CHAT_SERVICE_SERVERNAME;
    const postData = {
      new_password: user_matrix_password,
      logout_devices: true
    };

    const result = await this.chatRawApiPost(
      "/_synapse/admin/v1/reset_password/" + matrixUserId + "?access_token=" + accessToken,
      postData
    );

    if (result) {
      return true;
    } else {
      return false;
    }
  }

  /**
   * Send a message on a given room
   * @param matrix_auth_token: string auth token to post this message
   * @param room_id: string room ID
   * @param message: string message to send
   * @returns true if everything went well
   */
  async send(matrix_auth_token: string, room_id: string, message: string): Promise<boolean> {
    const matrix_client = await this.getMatrixClient(MatrixClientType.MATRIX_CLIENT_USER, matrix_auth_token);

    try {
      await matrix_client.sendEvent(
        room_id,
        sdk.EventType.RoomMessage,
        sdk.ContentHelpers.makeTextMessage(message),
        ""
      );
    } catch (err) {
      logInfo("Error during Matrix message sending");
      logInfo(err);
      return false;
    }

    return true;
  }

  /**
   * Send avatar URL for given room
   * @param room_id: string room ID
   * @param avatar_url: string URL of the avatar
   * @returns true if everything went well
   */
  async setRoomAvatar(room_id: string, avatar_url: string): Promise<void> {
    const matrix_admin_client = await this.getMatrixClient(MatrixClientType.MATRIX_CLIENT_ADMIN);

    try {
      const content = {
        url: avatar_url
      };

      logInfo("Setting avatar for room " + room_id + " to " + avatar_url, content);

      await matrix_admin_client.sendStateEvent(room_id, sdk.EventType.RoomAvatar, content);
    } catch (err) {
      logInfo("Error during Matrix message sending");
      logInfo(err);
    }
  }

  /**
   * Send a message on a given room, as admin
   * @param room_id: string room ID
   * @param message: string message to send
   * @returns true if everything went well
   */
  async sendAsAdmin(room_id: string, message: string, metadata?: BaztilleChatMessageMedata): Promise<boolean> {
    const matrix_client = await this.getMatrixClient(MatrixClientType.MATRIX_CLIENT_ADMIN);

    try {
      logInfo("Sending message as admin in room " + room_id + ": " + message + " with metadata ", metadata);

      if (metadata) {
        const metadata_marker = "##baztilledata##";

        message += metadata_marker + JSON.stringify(metadata);
      }

      const result = await matrix_client.sendEvent(
        room_id,
        sdk.EventType.RoomMessage,
        sdk.ContentHelpers.makeTextMessage(message),
        ""
      );

      console.log("Result of sendEvent: ", result);

      return true;
    } catch (err) {
      logInfo("Error during Matrix message sending");
      logInfo(err);
      return false;
    }
  }

  /**
   * Send a message on "Announcement" room
   * @param message: string message to send
   * @param metadata optional metadata to send with the message
   * @returns true if everything went well
   */
  async sendAdminAnnouncement(message: string, metadata?: BaztilleChatMessageMedata): Promise<boolean> {
    // Find "announcement" room
    const default_rooms = JSON.parse(process.env.CHAT_SERVICE_DEFAULT_ROOMS ?? "[]");

    let annoucement_room_id = null;
    for (const i in default_rooms) {
      if (default_rooms[i].comment == "annoucements") {
        annoucement_room_id = default_rooms[i].id;
      }
    }

    if (annoucement_room_id) {
      return this.sendAsAdmin(annoucement_room_id, message, metadata);
    } else {
      logError("Warning: sendAdminAnnouncement: no 'annoucements' room found");
    }

    return true;
  }

  /**
   * Send a message in "My notifications" room for given user
   * This room is used to send notifications to user inside the app
   * @param userId : string user ID
   * @param message : string message to send
   * @returns
   */
  async sendNotificationToUser(
    userId: string,
    message: string,
    metadata?: BaztilleChatMessageMedata
  ): Promise<boolean> {
    // Find "my notifications" room for this user
    const user = await this.userModel.findById(userId, { myNotificationsChatroom: 1, removedAccountDate: 1 });
    if (!user) {
      throw new BadRequestException("Cannot find user " + userId);
    }

    if (user.removedAccountDate) {
      logError(
        "Warning: sendNotificationToUser: user " + userId + " has a removedAccountDate => not sending notification"
      );
      return false;
    }

    if (!user.myNotificationsChatroom) {
      logError("Warning: sendNotificationToUser: no 'my notifications' room found for user " + userId);
      return false;
    }

    return this.sendAsAdmin(user.myNotificationsChatroom, message, metadata);
  }

  /* Create a notification chat room for all users
   *  (only for admins / should be run only once)
   */
  async createNotificationChatRoomForAllUsers() {
    logInfo("Creating a Notification chatroom for each user that does not have one");

    try {
      const users = await this.userModel.find({
        myNotificationsChatroom: { $exists: false },
        removedAccountDate: { $exists: false },
        role: { $nin: [Role.VISITOR, Role.USER_INCOMPLETE] }
      });

      for (const user of users) {
        await this.createMyNotificationsChatroomForUser(user._id.toString());

        // Pause during 1s between each creation to avoid overloading the Matrix server
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    } catch (error) {
      logError("Error generating chatroom Invitation code for all users:", error);
      throw new Error("Failed to generate chatroom my notifications for all users");
    }
  }

  /* Create a "My notifications" chatroom for given user (and store its ID on DB)
   * This chatroom is used to send notifications to user inside the app
   * This chatroom have 2 members: the user itself and the "baztille" user
   * @param userId: string user ID
   * @returns chatroom ID
   */
  async createMyNotificationsChatroomForUser(userId: string) {
    const matrix_client = await this.getMatrixClient(MatrixClientType.MATRIX_CLIENT_ADMIN);

    const matrixUserId = "@" + userId + ":" + process.env.CHAT_SERVICE_SERVERNAME;
    logDebug("Creating a new MyNotifications chatroom for user " + userId + " with Matrix user ID " + matrixUserId);

    const result = await matrix_client.createRoom({
      preset: sdk.Preset.PrivateChat,
      invite: [matrixUserId],
      name: "MY_NOTIFICATIONS", // This label aims to be recognized by the app to be replaced by a localized string
      is_direct: true,
      power_level_content_override: {
        events: {
          "m.room.message": 50 // User can send messages => set to power level 50 => as default level is 0 this user cannot send messages
        }
      }
    });

    //await matrix_client.setPowerLevel( result.room_id, matrixUserId, 0);  // Invited user has no power (= cannot do anything in this room except receving message)

    logDebug("matrix_client.createRoom returned room ID ", result.room_id);

    logInfo("Created a new MyNotifications chatroom for user " + userId + " with ID " + result.room_id);
    // Store this room ID in user profile
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          myNotificationsChatroom: result.room_id
        }
      }
    );

    logInfo("Stored chatroom ID " + result.room_id + " in user profile for user " + userId);
  }

  /* Create a new chatroom for a given territory
   *  This chatroom is used to publish voting events on this territory
   *  Return the chatroom ID
   * @param territoryName: string name of the territory
   * @returns chatroom ID
   */
  async createTerritoryChatroom(territoryName: string): Promise<string> {
    const matrix_client = await this.getMatrixClient(MatrixClientType.MATRIX_CLIENT_ADMIN);

    logDebug("Creating a new chatroom for territory " + territoryName);

    const result = await matrix_client.createRoom({
      preset: sdk.Preset.PublicChat,
      name: territoryName,
      topic: territoryName,
      power_level_content_override: {
        events: {
          "m.room.message": 50 // So that normal users cannot send messages in this room
        }
      }
    });

    logDebug("matrix_client.createRoom returned room ID ", result.room_id);

    logInfo("Created a new chatroom for territory " + territoryName + " with ID " + result.room_id);

    return result.room_id;
  }

  /*******************************************
   ********* UTILITY METHODS *****************
   */

  /**
   * Get a Matrix client with 2 possible options
   * @returns matrix client
   */
  private async getMatrixClient(type: MatrixClientType, matrix_auth_token?: string): Promise<sdk.MatrixClient> {
    if (type == MatrixClientType.MATRIX_CLIENT_ADMIN && this.adminMatrixClient) {
      // The admin matrix client has been initialized already => return it
      return this.adminMatrixClient;
    } else {
      logInfo("Initializing a new Matrix SDK client");

      if (
        process.env.CHAT_SERVICE_API_ENDPOINT == undefined ||
        process.env.CHAT_SERVICE_ADMIN_USER == undefined ||
        process.env.CHAT_SERVICE_ADMIN_PASSWORD == undefined
      ) {
        logError("CHAT_SERVICE_API_ENDPOINT or CHAT_SERVICE_ADMIN_USER or CHAT_SERVICE_ADMIN_PASSWORD is not defined");
        throw new Error(
          "CHAT_SERVICE_API_ENDPOINT or CHAT_SERVICE_ADMIN_USER or CHAT_SERVICE_ADMIN_PASSWORD is not defined"
        );
      }

      const chat_api: string = process.env.CHAT_SERVICE_API_ENDPOINT;
      const matrixClient = sdk.createClient({ baseUrl: chat_api });

      if (type == MatrixClientType.MATRIX_CLIENT_ADMIN) {
        // Log as admin
        this.adminMatrixClient = matrixClient;
        logInfo(
          "Log admin client with " + process.env.CHAT_SERVICE_ADMIN_USER + "/" + process.env.CHAT_SERVICE_ADMIN_PASSWORD
        );
        const accessToken = await this.logUserIn(
          this.adminMatrixClient,
          process.env.CHAT_SERVICE_ADMIN_USER,
          process.env.CHAT_SERVICE_ADMIN_PASSWORD
        );
        this.adminMatrixClient.setAccessToken(accessToken);
      } else if (type == MatrixClientType.MATRIX_CLIENT_USER) {
        if (matrix_auth_token) {
          // Set this auth token
          matrixClient.setAccessToken(matrix_auth_token);
        }
      } else if (type == MatrixClientType.MATRIX_CLIENT_UNLOGGED) {
        // Return matrix client as it is
      }

      return matrixClient;
    }
  }

  /**
   * Log user in chat system API on given matrix client
   * @param username
   * @param password
   * @returns authentification token
   */
  private async logUserIn(
    matrix_client: sdk.MatrixClient,
    username: string,
    password: string,
    bForce = true
  ): Promise<string> {
    if (matrix_client.isLoggedIn()) {
      if (bForce) {
        // Force login even if logged already
        // => skip this
      } else if (matrix_client.http.opts.accessToken) {
        logInfo("Already logged in. Aborting.");
        return matrix_client.http.opts.accessToken;
      } else {
        logInfo("Already logged in but no access token found. Continuing login.");
      }
    }

    logInfo("Logging user " + username + " on Chat system");

    const data = await matrix_client.login("m.login.password", {
      user: username,
      password: password
    });

    if (!data) {
      return "";
    }

    if (matrix_client.http.opts.accessToken == undefined || matrix_client.http.opts.accessToken == "") {
      logInfo("Login failed. No access token received.");
      return "";
    }

    return matrix_client.http.opts.accessToken;
  }

  /**
   * Call given URL with an HTTP GET request
   * @param uri URL to call
   * @returns Data collected
   */
  async chatRawApiGet(path) {
    const uri = process.env.CHAT_SERVICE_API_ENDPOINT + path;
    logInfo("Chat API raw call GET " + uri);

    try {
      const response: { data: any } = await firstValueFrom(this.httpService.get(uri));

      logInfo("Fetching response:");
      logInfo(response.data);
      return response.data;
    } catch (error) {
      logInfo("Error during HTTP call " + uri);
      logInfo("Error code: " + error.code);
      logInfo("Response status: " + error.response.status);
      logInfo("Response status text: " + error.response.statusText);
    }
  }

  /**
   * Post given data on specific URL with an HTTP POST request
   * @param uri URL to call
   * @param data content of the data to post (payload)
   * @param config header configuration to provide to the HTTP POST
   * @returns Data collected
   */
  async chatRawApiPost<T>(path: string, data: any, config: any = {}) {
    const uri = process.env.CHAT_SERVICE_API_ENDPOINT + path;
    logInfo("Posting data to URL " + uri);

    try {
      const multipleResponse = this.httpService.post(uri, data, config);
      logDebug(multipleResponse);
      const response = await firstValueFrom(multipleResponse);

      logInfo("Fetching response:");
      logInfo(response);
      if (response.data) {
        return response.data;
      } else {
        return null;
      }
    } catch (error) {
      logInfo("Error during HTTP POST " + uri);
      logInfo("Error code: " + error.code);
      logDebug(error);
      logDebug(error.response);
      logInfo("Response status: " + error.response?.status);
      logInfo("Response status text: " + error.response?.statusText);
      logInfo(error?.response?.data);
    }
  }

  /**
   * Put given data on specific URL with an HTTP PUT request
   * @param uri URL to call
   * @param data content of the data to post (payload)
   * @param config header configuration to provide to the HTTP POST
   * @returns Data collected
   */
  async chatRawApiPut(path: string, data: any, config: any = {}) {
    const uri = process.env.CHAT_SERVICE_API_ENDPOINT + path;
    logInfo("PUT data to URL " + uri);

    try {
      const response: { data: any } = await firstValueFrom(this.httpService.put(uri, data, config));

      logInfo("Fetching response:");
      logInfo(response.data);
      return response.data;
    } catch (error) {
      logInfo("Error during HTTP PUT " + uri);
      logInfo("Error code: " + error.code);
      logInfo("Response status: " + error.response.status);
      logInfo("Response status text: " + error.response.statusText);
      logInfo(error?.response?.data);
    }
  }

  /**
   * Send a Firebase notification to given user
   * @returns ok
   */
  testNotif(params: any): any {
    logInfo("Send a test notification on Firebase");

    this.firebaseService.test(params);
  }
}
