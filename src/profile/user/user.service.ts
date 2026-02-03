import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import { isDisposableEmail } from "disposable-email-domains-js";
import mongoose, { DeleteResult, Model, UpdateQuery } from "mongoose";
import { ChatService } from "src/chat/chat.service";
import { emailToKey, encodeBase28, generateVerificationCode } from "src/common/common-functions";
import { FileUploadService } from "src/common/common-services/file-upload.service";
import { EmailService } from "src/common/email/email.service";
import { Role } from "src/common/enum";
import { InternalEventsEnum } from "src/common/enum/internal-events.enum";
import { GlobalKey } from "src/common/globals/globals.enum";
import { GlobalsService } from "src/common/globals/globals.service";
import { CountrymodelService } from "src/countrymodel/countrymodel.service";
import { TerritoryMongo } from "src/countrymodel/schema/territory.schema";
import { TrackEventType } from "src/event/event-types";
import { EventService } from "src/event/event.service";
import { UserDiscoverStep } from "src/profile/user/types/user-discover-step.enum";
import { getCurrentDate } from "src/utils/date-time";
import { logDebug, logError, logInfo } from "src/utils/logger";
import { DeletedUserMongo } from "./deleted-user.schema";
import { CreateUserDto } from "./dto/create-user.dto";
import { RecruitDto } from "./dto/recruit.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UserPrivateViewDto } from "./dto/user-private-view.dto";
import { UserPublicViewDto } from "./dto/user-public-view.dto";
import { User } from "./types/user.type";
import {
  AppStoreType,
  SocialNetworkType,
  UserActivityMongo,
  UserDeviceMongo,
  UserDocument,
  UserKey,
  UserMongo
} from "./user.schema";

@Injectable()
export class UserService {
  user_accessible_fields: { [key: string]: 1 };
  public_accessible_fields: { [key: string]: 1 };

  constructor(
    @InjectModel(UserMongo.name) private readonly userModel: Model<UserMongo>,
    @InjectModel(DeletedUserMongo.name) private readonly deletedUserModel: Model<DeletedUserMongo>,
    private fileUploadService: FileUploadService,
    private readonly countryModelService: CountrymodelService,
    private readonly chatserviceService: ChatService,
    private emailService: EmailService,
    private eventEmitter: EventEmitter2,
    private globalService: GlobalsService,
    private eventService: EventService
  ) {
    // User fields that the corresponding user is allowed to view
    this.user_accessible_fields = {
      email: 1,
      role: 1,
      pollingStationId: 1,
      pollingStationUncertain: 1,
      publicName: 1,
      points: 1,
      birthDate: 1,
      firstName: 1,
      lastName: 1,
      phoneNumber: 1,
      missionsCompleted: 1,
      mentorInvitationCode: 1,
      socialNetworks: 1,
      avatar: 1,
      recruits: 1,
      discoverStep: 1
    };

    // Public fields that can be accessed by anyone
    this.public_accessible_fields = {
      role: 1,
      publicName: 1,
      points: 1,
      avatar: 1,
      creationDate: 1
    };
  }

  /**
   * Creates a new user based on the provided user data.
   *
   * This function first validates the city, address, and country fields
   * to ensure they meet certain criteria. If any of these fields are invalid,
   * a BadRequestException is thrown.
   *
   * Upon successful validation, the function attempts to save the user data
   * into the database. If the email address provided already exists in the database,
   * a ConflictException is thrown.
   *
   * @param createUserDto The data transfer object containing the user's information.
   * @returns The newly created user if successful.
   * @throws BadRequestException if the city, address, or country is invalid.
   * @throws ConflictException if the email address already exists in the database.
   * @throws Error if any other unexpected error occurs during the process.
   */
  async create(createUserDto: CreateUserDto, bAsAdmin: boolean): Promise<UserPrivateViewDto> {
    const newUser: Partial<UserDocument> = { ...createUserDto };
    // Map legacy snake_case input fields to camelCase schema fields
    if ((newUser as any).pollingStationUncertain !== undefined && newUser.pollingStationUncertain === undefined) {
      newUser.pollingStationUncertain = (newUser as any).pollingStationUncertain;
      delete (newUser as any).pollingStationUncertain;
    }

    // Check if polling station exists
    if (newUser.pollingStationId) {
      const territory = await this.countryModelService.getTerritory(newUser.pollingStationId);

      if (territory) {
        if (territory.type.name == "Polling Station") {
          logInfo("User provided a legitimate polling station");
        } else {
          if (bAsAdmin && newUser.pollingStationId == "000000000000000000000000") {
            logInfo("Admin wants to create a fake user with a random polling id (tests purpose)");

            newUser.pollingStationId = await this.countryModelService.getRandomPollingStation();
          } else {
            throw new Error("Non existing polling station");
          }
        }
      } else {
        throw new Error("Non existing territory ID during user creation");
      }
    } else {
      // DEPRECATED: now we create user without polling station (this comes later)
      //throw new Error("Polling station ID is required");
      // Note: polling stations is required, but user can still set the "pollingStationUncertain" flag to true in CreateUserDto
    }

    // Check everything about email (validity, not already used, not used by a recently deleted user, ...)
    // CheckNewEmailValidity also normalize the email => this is our new "email" reference field for this user
    // (throw an exception if not valid)
    newUser.key = await this.checkNewEmailValidity(createUserDto.email);

    // Generate a unique mentor invitation code so that this user can invite his friends
    newUser.mentorInvitationCode = await this.generateUniqueMentorInvitationCode();

    newUser.creationDate = getCurrentDate().getTime();
    newUser.lastSession = getCurrentDate().getTime();

    // If there is a invitation code, we need to check if it is valid & get the corresponding mentor user
    if (createUserDto.invitationCode && createUserDto.invitationCode != "") {
      logInfo("User provided an invitation code: ", createUserDto.invitationCode);

      // Check if the invitation code is valid
      const mentorUser = await this.userModel.findOne({
        mentorInvitationCode: createUserDto.invitationCode
      });

      // If no mentor user found ...
      if (!mentorUser) {
        logError("Mentor invitation code is not valid: ", createUserDto.invitationCode);

        // We log that the invitation code is not valid, but we do not throw an error as it is not critical
        // We just ignore the invitation code

        //throw new BadRequestException('Mentor invitation code is not valid');
      } else if (mentorUser.removedAccountDate) {
        logError("Mentor invitation code belongs to a user that removed its account: " + createUserDto.invitationCode);

        // We log that the invitation code is not valid, but we do not throw an error as it is not critical
        // We just ignore the invitation code
      } else {
        // Mentor exists and has not been removed

        // Set the invitedBy field to the mentor user ID
        newUser.mentor = mentorUser._id;
      }
    }

    newUser.territories = new Map(); // Will be filled later asynchronously

    // Save user in DB
    logInfo("Creating user with email: ", newUser.email);
    const user = new this.userModel(newUser);
    let createdUser: UserDocument;
    try {
      createdUser = await user.save();
    } catch (error) {
      if (error.code == 11000) {
        logError("Duplicate email error: ", error);

        // Duplicate email
        // Note: we should never arrive here as we check email validity before
        throw new BadRequestException("Email address already exists");
      } else {
        throw error;
      }
    }

    // Post user creation tasks (asynchronously) ////////////////

    // Track user creation event
    await this.eventService.trackEvent(TrackEventType.CREATE_USER, {
      forceUserId: createdUser._id, // Force this event to be linked to the created user (even if not logged in yet)
      withInvitation: createdUser.mentor ? true : false
    });

    // Get territories linked to user from polling station
    if (createdUser.pollingStationId) {
      const territories = await this.countryModelService.getParentTerritoriesFrom(createdUser.pollingStationId);
      if (territories) {
        logDebug("User territories: ", territories);
        await this.userModel.updateOne({ _id: createdUser._id }, { $set: { territories: territories } });
      }
    }

    // Add user to the list of recruits of the mentor user
    // + update number of recruits for the mentor user
    // Note: we should not do this now as the user did not verify his email yet => we do it when user goes from role "VISITOR" to "USER" now
    //this.addUserToRecruitsList( createdUser._id, newUser.mentor );

    // Create "My notifications" chatroom for this user
    this.chatserviceService
      .createMyNotificationsChatroomForUser(createdUser._id)
      .then(() => logInfo(`createMyNotificationsChatroomForUser OK user=${createdUser._id}`))
      .catch((err) => {
        logError(`createMyNotificationsChatroomForUser FAIL user=${createdUser._id}: ${err?.message}`, err?.stack);
      });

    return this.getUserPrivateById(createdUser._id); // Return the user we just created
  }

  /**
   * Checks the validity of a new email address:
   * - correct format
   * - not already used by another user
   * - not used by a recently deleted user
   * - not temporary email address (disposable email)
   * Throw an exception if not valid
   * Return normalized email if valid
   * @param email email to check (not necessarily normalized)
   */
  async checkNewEmailValidity(email: string): Promise<UserKey> {
    // Check email format + turn it into key
    const user_key = emailToKey(email);

    // Check if key is already used (= email already used)
    const existingUser = await this.userModel.findOne({ key: user_key });
    if (existingUser) {
      throw new BadRequestException("Email address already exists");
    }

    // Note: we do not check if email is already used: this should not happen as we checked key does not exists

    // Check if email is used by a recently deleted user
    const seven_days_ago = getCurrentDate().getTime() - 7 * 24 * 60 * 60 * 1000;
    const deleted_user = await this.deletedUserModel.findOne({ key: user_key, deletedAt: { $gte: seven_days_ago } });
    if (deleted_user) {
      logError("User " + email + " already removed its account recently, cannot create a new account with same email");
      throw new BadRequestException("Email address already used by a recently deleted account");
    }

    // Check if email is a temporary email address
    if (isDisposableEmail(email)) {
      throw new BadRequestException("Temporary email addresses are not allowed");
    }

    return user_key;
  }

  /**
   * Adds a user to the recruits list of a mentor user.
   * This function updates the mentor's recruits list by adding the user ID
   * +  trigger eventual missions
   * @returns
   */
  async addUserToRecruitsList(userId: string, mentorId: string | undefined) {
    if (!mentorId || mentorId == "") {
      logDebug("No mentor ID provided, skipping adding user to recruits list");
      // Note: this happens when user did not have a mentor
      return;
    }

    // Get this user level & last activity time
    const user = await this.userModel.findById(userId, { activity: 1, level: 1 });

    if (!user) {
      throw new NotFoundException("User not found: " + userId);
    }

    // Add user to the recruits list of the mentor user
    await this.userModel.findByIdAndUpdate(mentorId, {
      $set: {
        ["recruits." + userId]: { level: user.level, lastVoteTime: user?.activity?.lastGeneralVoteDate }
      }
    });

    logInfo("Added user " + userId + " to the recruits list of mentor " + mentorId);

    // Trigger eventual missions for the mentor user
    this.eventEmitter.emit(InternalEventsEnum.USER_CHECK_MISSIONS_FOR_USER, { userId: mentorId });
  }

  findAll() {
    return this.userModel.find().select("-emailValidationCode -isArchived -isDeleted");
  }

  /**
   * Get users email adresses from a specific filter
   * @param filter filter to apply
   * @returns array of email adresses
   */
  async getUserEmailsFromFilter(filter: mongoose.FilterQuery<UserDocument>): Promise<string[]> {
    const users: UserDocument[] = await this.userModel.find(filter).select("email");

    const emails: string[] = [];
    users.forEach((user) => {
      emails.push(user.email);
    });

    return emails;
  }

  /**
   * Finds a user document by its ID and populates nested fields.
   * ===> This is the method used to populate the user data
   * ===>  that is loaded into "@Req() req" fields
   *
   * **Parameters:**
   *   - id: The unique identifier of the user document to find.
   *
   * **Returns:**
   *   - A Promise that resolves with the found user document, including:
   *   - - User information
   *   - If no user is found with the given ID, resolves with null.
   *   - Throws an HttpException with status 500 if an error occurs during the find operation.
   */
  async getUserCompleteById(id: string): Promise<User> {
    return this.getUserFromDbFilter({ _id: id }) as Promise<User>;
  }
  async getUserPrivateById(id: string): Promise<UserPrivateViewDto> {
    return this.adaptUserToPrivateView(await this.getUserFromDbFilter({ _id: id }));
  }
  async getUserPublicById(id: string): Promise<UserPublicViewDto> {
    return this.adaptUserToPublicView(await this.getUserFromDbFilter({ _id: id }));
  }

  /**
   * Finds a user document by their email address and populates nested fields.
   *
   * **Parameters:**
   *   - email: The email address of the user to find.
   *            (Note: the email is normalized before search to make sure we find the right user)
   *
   * **Returns:**
   *   - A Promise that resolves with the found user document, including:
   *   - - User information
   *   - If no user is found with the given email, resolves with null.
   *   - Throws an HttpException with status 500 if an error occurs during the find operation.
   */
  async getUserCompleteByEmail(email: string): Promise<User> {
    const key = emailToKey(email);
    return this.getUserFromDbFilter({ key: key });
  }
  async getUserPrivateByEmail(email: string): Promise<UserPrivateViewDto> {
    const key = emailToKey(email);
    return this.adaptUserToPrivateView(await this.getUserFromDbFilter({ key: key }));
  }
  async getUserPublicByEmail(email: string): Promise<UserPublicViewDto> {
    const key = emailToKey(email);
    return this.adaptUserToPublicView(await this.getUserFromDbFilter({ key: key }));
  }

  /**
   * Retrieves a user document from the database based on the provided filter.
   * @param filter The filter to apply when searching for the user.
   * @param user_content_mode The content mode to apply when retrieving the user.
   * @returns A Promise that resolves with the found user document, or null if not found.
   */
  private async getUserFromDbFilter(filter: mongoose.FilterQuery<UserDocument>): Promise<User> {
    const result: User = await this.userModel
      .findOne(filter)
      .populate<TerritoryMongo>("pollingStationId", { name: 1, officialCode: 1, type: 1 })
      .select("-emailValidationCode -isArchived -isDeleted");

    // Territories properties to details for each user territory
    /*const territory_properties = [
      "name",
      "officialCode",
      "type",
      "organization",
      "registeredUsersCount",
      "votableTerritory"
    ];*/

    result.territoriesInfos = await this.countryModelService.getTerritories(
      result.territories ? Array.from(result.territories.values()) : []
    );

    return result;
  }

  async getPublicAccessibleFields() {
    return this.public_accessible_fields;
  }

  /*
   ** Adapts User in backend format to the format we want on App side (UserPrivateViewDto)
   */
  private adaptUserToPrivateView(user: User): UserPrivateViewDto {
    const {
      _id,
      email,
      role,
      pollingStationId,
      pollingStationUncertain,
      publicName,
      points,
      birthDate,
      firstName,
      lastName,
      phoneNumber,
      mentorInvitationCode,
      socialNetworks,
      avatar,
      recruits,
      discoverStep
    } = user;

    const private_user: UserPrivateViewDto = {
      _id,
      email,
      role,
      pollingStationId,
      pollingStationUncertain,
      publicName,
      points,
      birthDate,
      firstName,
      lastName,
      phoneNumber,
      mentorInvitationCode,
      socialNetworks,
      avatar,
      recruits,
      discoverStep,
      nbrCollectableMissions: 0,
      territoriesInfos: []
    };

    // Count number of collectable missions (which is the only important info from "missions completed field")
    // (reason: we do not want to send the whole array to the client - it may be large)
    if (user.missionsCompleted) {
      user.missionsCompleted.forEach((mission, i) => {
        if (mission.collected == false) {
          private_user.nbrCollectableMissions++;
        }
      });
    }

    // Territories infos
    user.territoriesInfos.forEach((territoryInfo) => {
      private_user.territoriesInfos.push({
        _id: territoryInfo._id,
        name: territoryInfo.name,
        type: territoryInfo.type,
        isVotable: territoryInfo.votableTerritory ? territoryInfo.votableTerritory.votableDecisions : false,
        currentFeaturedDecisionTrigger: territoryInfo.votableTerritory
          ? territoryInfo.votableTerritory.currentFeaturedDecisionTrigger
          : undefined,
        chatroomId: territoryInfo.votableTerritory ? territoryInfo.votableTerritory.chatroomId : undefined
      });
    });

    return private_user;
  }

  /*
   ** Adapts User in backend format to the format we want on App side (UserPublicViewDto)
   */
  private adaptUserToPublicView(user: User): UserPublicViewDto {
    const { _id, role, publicName, points, avatar, creationDate } = user;

    const public_user: UserPublicViewDto = { _id, role, publicName, points, avatar, creationDate };

    return public_user;
  }

  /* Check if a user already have this phone number
   **  Note: phone number must be E.164 format
   **/
  async checkIfPhoneExists(phoneNumber: string) {
    const res = await this.userModel.find({ phoneNumber: phoneNumber }, {});

    logDebug("finding phone number: " + phoneNumber + ", result = ", res);
    if (res.length > 0) {
      return true; // Phone exists already
    } else {
      return false;
    }
  }

  /** Check if a phone number exists in recently deleted users
   * Note: phone number must be E.164 format
   **/
  async checkIfPhoneExistsInDeletedUsers(phoneNumber: string) {
    const res = await this.deletedUserModel.find({ phoneNumber: phoneNumber }, {});
    logDebug("finding deleted phone number: " + phoneNumber + ", result = ", res);
    if (res.length > 0) {
      return true; // Phone exists in deleted users
    } else {
      return false;
    }
  }

  /**
   * Updates user information based on the provided email address.
   * Note: only informations that user can change himself should be here
   *
   * This function attempts to find and update the user document in the database
   * using the provided email address. If the user is found and updated successfully,
   * the updated user object is returned.
   *
   * If no user is found with the provided email address, a NotFoundException is thrown.
   *
   * Any other errors that occur during the process are re-thrown for global exception handling.
   *
   * @param email The email address of the user to update.
   * @param updateUserDto The data transfer object containing the updated user information.
   * @returns The updated user object if successful.
   * @throws NotFoundException if no user is found with the provided email address.
   * @throws Error if any other unexpected error occurs during the process.
   */
  async updateUser(email: string, updateUserDto: UpdateUserDto): Promise<UserPrivateViewDto> {
    // Find user (from email)
    const user: User = await this.getUserCompleteByEmail(email);

    if (!user) {
      throw new NotFoundException("User not found: " + email);
    }

    const userUpdateQuery: UpdateQuery<User> = {};

    if (updateUserDto.firstName || updateUserDto.lastName) {
      // The user is asking for an Identity change

      // Convert firstname and lastname to lowercase
      updateUserDto.firstName = updateUserDto.firstName?.toLowerCase();
      updateUserDto.lastName = updateUserDto.lastName?.toLowerCase();

      // TODO: trigger here any logic linked to ID change
      //  - store an ID history for this user?
      //  - reset user's ID trust level to its minimum?
    }

    if (updateUserDto.publicName) {
      // The user change his public name

      if (updateUserDto.publicName.length < 3) {
        throw new Error("Your public name must contains at least 3 characters");
      } else if (updateUserDto.publicName.length > 50) {
        throw new Error("Your public name must contains less than 50 characters");
      }

      // Filter smileys
      updateUserDto.publicName = updateUserDto.publicName.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "");

      // TODO: check if this match our minimum requirements
      //       check if it did not change too often
      //       check if this does not match the realname of another person (forbidden)

      // TODO: trigger here any logic linked to public name change
      //  - if it matches firstname/lastName + user is identity verified, we may want to add a "verified" check on the profile
      //  - change name on chat server

      // Change public name on Chat server
      await this.chatserviceService.updatePublicName(user._id, updateUserDto.publicName);

      // Note: check that we do not return user private infos in this request response
    }

    if (updateUserDto.birthDate) {
      // The user change his birthdate
      logInfo("User " + email + " is changing his birthdate");

      // Check if the user's age meet the minimum requirement for voting
      const minAge = parseInt(process.env.COUNTRY_LEGAL_VOTE_AGE ?? "18");
      const userBirthDate = new Date(updateUserDto.birthDate);
      const userAge = this.calculateAgeFromBirthDate(userBirthDate);

      logInfo("User " + email + " is " + userAge + " years old");

      if (userAge < minAge) {
        logError("User " + email + " is too young to vote");
        throw new Error("You must be at least " + minAge + " years old to register on Baztille");
      }

      // TODO: trigger here any logic linked to ID change
      //  - reset user's ID trust level to its minimum?
    }

    // Map legacy snake_case DTO fields to camelCase before processing
    if ((updateUserDto as any).pollingStationId && !updateUserDto.pollingStationId) {
      (updateUserDto as any).pollingStationId = (updateUserDto as any).pollingStationId;
      delete (updateUserDto as any).pollingStationId;
    }
    if ((updateUserDto as any).discoverStep && !(updateUserDto as any).discoverStep) {
      (updateUserDto as any).discoverStep = (updateUserDto as any).discoverStep;
      delete (updateUserDto as any).discoverStep;
    }
    if (
      (updateUserDto as any).pollingStationUncertain !== undefined &&
      (updateUserDto as any).pollingStationUncertain === undefined
    ) {
      (updateUserDto as any).pollingStationUncertain = (updateUserDto as any).pollingStationUncertain;
      delete (updateUserDto as any).pollingStationUncertain;
    }

    if (updateUserDto.pollingStationId) {
      // User changes voting location

      const territory = await this.countryModelService.getTerritory(updateUserDto.pollingStationId);

      if (territory) {
        if (territory.type.name == "Polling Station") {
          logInfo("User provided a legitimate polling station");
        } else {
          throw new Error("Non existing polling station");
        }
      } else {
        throw new Error("Non existing territory ID during user update");
      }

      // Check if polling station has changed in the last year
      const one_year_ago = getCurrentDate().getTime() - 365 * 24 * 60 * 60 * 1000;
      const recent_change = user.pollingStationHistory?.find((change) => {
        return change.until > one_year_ago;
      });
      if (recent_change) {
        throw new Error("You cannot change your voting location more than once a year");
      }

      // Save current polling station in history
      userUpdateQuery.$push = {
        pollingStationHistory: {
          pollingStationId: user.pollingStationId,
          until: getCurrentDate().getTime()
        }
      };

      // Update user territories from new polling station
      const territories = await this.countryModelService.getParentTerritoriesFrom(updateUserDto.pollingStationId);
      if (!territories) {
        throw new Error("Cannot find territories from polling station ID: " + updateUserDto.pollingStationId);
      }
      logDebug("User territories: ", territories);
      userUpdateQuery.$set = {
        ...userUpdateQuery.$set,
        pollingStationUncertain: false,
        territories: territories
      };
    }

    // Check whether there is already a user (different than the current user) with the same first name + last name + birthdate
    if (updateUserDto.firstName && updateUserDto.lastName && updateUserDto.birthDate) {
      const other_user = await this.userModel.findOne({
        firstName: updateUserDto.firstName,
        lastName: updateUserDto.lastName,
        birthDate: updateUserDto.birthDate,
        key: { $ne: emailToKey(email) } // Make sure we do not find the current user
      });

      if (other_user) {
        throw new Error("User already exists with this name and birthdate");
      }
    }

    userUpdateQuery.$set = {
      ...userUpdateQuery.$set,
      ...updateUserDto
    };
    logDebug("User update query: ", userUpdateQuery);
    const updatedUser = await this.updateUserDocument(email, userUpdateQuery);

    if (!updatedUser) {
      throw new NotFoundException("User not found");
    }

    // Check if USER_INCOMPLETE should be upgraded to USER
    if (updatedUser.role === Role.USER_INCOMPLETE) {
      // Check if all mandatory fields are filled
      const hasPublicName = !!updatedUser.publicName && updatedUser.publicName.length >= 3;
      const hasCity = !!updatedUser.pollingStationId;

      if (hasPublicName && hasCity) {
        // Upgrade to USER
        logInfo("User " + email + " has filled all mandatory fields, upgrading from USER_INCOMPLETE to USER");
        this.updateUserRole(email, Role.USER);
      }
    }

    //logDebug("User before update: ", user);
    //logDebug("Applied update: ", updateUserDto);
    //logDebug("User updated: ", updatedUser);

    if (
      user.discoverStep == UserDiscoverStep.NOT_CONVINCED &&
      typeof (updateUserDto as UpdateQuery<User>).discoverStep !== "undefined" &&
      (updateUserDto as UpdateQuery<User>).discoverStep == UserDiscoverStep.CONVINCED
    ) {
      // User is now convinced => track
      this.eventService.trackEvent(TrackEventType.USER_CONVINCED);
    }

    return this.getUserPrivateById(updatedUser._id);
  }

  /*
   ** Update user city
   * Note: we are supposed to update user city using polling station ID, however,
   *       using simplified registration at now, we just know the city and need this
   *       enndpoint to set polling station based on city ID
   * This method pick the first polling station found in this city + set the pollingStationUncertain flag to true
   * @param userId user ID
   * @param city city name
   */
  async setCity(userId: string, city: string) {
    logInfo("Setting city for user " + userId + " to " + city);

    // Get user
    const user = await this.getUserCompleteById(userId);

    if (!user) {
      throw new NotFoundException("User not found: " + userId);
    }

    // Find a polling station in this city
    const cityTerritory = await this.countryModelService.getTerritory(city);

    if (!cityTerritory) {
      throw new NotFoundException("City not found: " + city);
    }
    if (!cityTerritory.subdivisions || cityTerritory.subdivisions.length == 0) {
      throw new NotFoundException("No polling station found in city: " + city);
    }

    logDebug("City territory: ", cityTerritory);

    // We take first subdivision of type "Polling Station"
    const subdivision = cityTerritory.subdivisions[0];

    logDebug("Selected subdivision: ", subdivision);

    // Check subdivision type
    if (subdivision.subdivisionId.type.name != "Polling Station") {
      throw new NotFoundException("No polling station found in city: " + city);
    }

    // Update user polling station
    // Note: we use updateUser so that all the checks are done + cache territories for user are updated
    await this.updateUser(user.email, {
      pollingStationId: subdivision.subdivisionId._id,
      pollingStationUncertain: true
    });
  }

  /*
   ** Update given user to role + trigger all what is needed following this role update
   ** Throw exception if user not found
   ** @param email user email
   ** @param role new role
   */
  async updateUserRole(email: string, role: Role) {
    // Get current user role
    const currentUser = await this.getUserCompleteByEmail(email);

    if (currentUser.role === role) {
      logDebug("User " + email + " already has role " + Role[role] + ", no need to update");
      return;
    }

    logInfo("Updating user " + email + " role from " + Role[currentUser.role] + " to " + Role[role]);

    // Update role
    await this.updateUserDocument(email, { $set: { role: role } });

    // Trigger any logic linked to role change

    if (currentUser.role == Role.VISITOR && role == Role.USER) {
      // User is going from VISITOR to USER

      // Add user to the list of recruits of the mentor user
      // + update number of recruits for the mentor user
      logInfo("User " + email + " is going from VISITOR to USER, adding him to the recruits list of his mentor");
      this.addUserToRecruitsList(currentUser._id, currentUser.mentor);
    }
  }

  /*
   ** Update user document based on email & update query
   */
  async updateUserDocument(email: string, updateQuery: UpdateQuery<User>): Promise<UserDocument> {
    logDebug("Updating user document for ", email, " with query ", updateQuery);

    // Note: updateQuery already contains the operators ($set, $inc, ...)
    const updatedUser = await this.userModel.findOneAndUpdate({ key: emailToKey(email) }, updateQuery, { new: false });

    if (!updatedUser) {
      throw new NotFoundException("User not found");
    }

    return updatedUser;
  }

  /**
   * Updates user device information based on the provided email address.
   *
   * @param email The email address of the user to update.
   * @param deviceInfos The data transfer object containing the updated user device information.
   * @param bNewSession Boolean indicating if this is a new session (to update lastSession field).
   * @returns The updated user object if successful.
   * @throws NotFoundException if no user is found with the provided email address.
   * @throws Error if any other unexpected error occurs during the process.
   */
  async updateDevice(email: string, deviceInfos: UserDeviceMongo, bNewSession: boolean) {
    logInfo("updateDevice for ", email, deviceInfos);

    const user: User | null = await this.userModel.findOne({ key: emailToKey(email) });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const currentTime = getCurrentDate().getTime();

    const field_name = "devices." + deviceInfos.uuid;
    const updateData: Partial<User> = {
      [field_name]: deviceInfos
    };

    if (bNewSession) {
      updateData[field_name].lastSession = currentTime;
      updateData.lastSession = currentTime; // Also update the global lastSession field for the user
    } else {
      // Not a new session => lastSession must not be updated

      // Make sure lastSession value cannot be set by user
      if (updateData[field_name].lastSession) {
        logDebug(
          "updateDevice: lastSession is set, but we are not creating a new session, so we remove it from data to be updated"
        );
        delete updateData[field_name].lastSession;
      }
    }

    await this.userModel.updateOne({ key: emailToKey(email) }, { $set: updateData });

    if (deviceInfos.notifToken) {
      // If user enabled notifications, it may leads to a mission accomplished so check for it
      this.eventEmitter.emit(InternalEventsEnum.USER_CHECK_MISSIONS_FOR_USER, { userId: user._id });
    }

    return this.getUserPrivateById(user._id);
  }

  remove(id: string): Promise<DeleteResult> {
    return this.userModel.deleteOne({ _id: id });
  }

  /**
   * Upgrade given userID as Baztille member
   * Prerequisites: firstName/lastName/birthDate has been set (see update() method)
   * @param userId The ID of the user to upgrade
   * @param phoneNumber The (verified) phone number of the user
   * @returns updated user
   * @throws Exception if prerequisites are not valid
   */
  async updateToMember(userId: string, phoneNumber: string): Promise<User> {
    logInfo("Upgrading user " + userId + " to Baztille member");

    const user = await this.userModel.findById(userId);
    if (!user) {
      throw new Error("Cannot find user " + userId);
    }
    /*

    We DISABLE check for first name / last name / birthdate for now as we want to make it easier to join Baztille
    during the "ramp up" phase.

    This check will be reintroduced later (do not remove this code)
    
    //

    if (user.firstName == '') {
      throw new Error('Trying to become a member while first name has not been set');
    }
    if (user.lastName == '') {
      throw new Error('Trying to become a member while last name has not been set');
    }
    if (!user.birthDate) {
      throw new Error('Trying to become a member while birthdate has not been set');
    }
    */
    if (user.role != Role.USER) {
      throw new Error("Trying to become a member while not being a user");
    }

    // Update user
    // Note: phoneNumber is supposed to be unique as we are checking this on "send-code" step (see sms sendVerificationCode)
    const userdata = {
      phoneNumber: phoneNumber,
      memberSince: getCurrentDate().getTime()
    };
    logInfo("Updating user " + userId + " to member", userdata);
    await this.userModel.updateOne({ _id: userId }, { $set: userdata });
    await this.updateUserRole(user.email, Role.MEMBER);

    // Track user upgrade to member event (= phone verified)
    await this.eventService.trackEvent(TrackEventType.PHONE_VERIFIED);

    return this.getUserCompleteById(userId);
  }

  /**
   * Send a test email to given user
   * @param userId The ID of the user to send an email to
   * @returns void
   * @throws Exception if error
   */
  async testEmail(userId: string) {
    logInfo("Sending a test email to user ", userId);

    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new Error("Cannot find user " + userId);
    }

    console.log("Sending email to: ", user.email);

    await this.emailService.sendMail({
      dynamicTemplateData: {},
      templateId: "test_email",
      to: user.email
    });
  }

  /**
   * This function retrieves recruits based on the mentor ID (= inviter ID)
   * It returns all what is needed to display the recruits list on app side
   * @param {string} mentorId - string representing the ID of the user who invited other users.
   * @returns list of recruits with additional informations
   */
  async getRecruits(mentorId: string): Promise<RecruitDto[]> {
    return this.userModel.find(
      {
        mentor: mentorId,
        removedAccountDate: { $exists: false } // Make sure we do not return users that removed their account
      },
      {
        _id: 1,
        creationDate: 1,
        publicName: 1,
        avatar: 1,
        level: 1,
        points: 1,
        "activity.lastGeneralVoteSessionId": 1,
        "activity.lastGeneralVoteDate": 1
      }
    );
  }

  /**
   * Increment some user activity stat
   */
  async incrementUserActivityStat(userId: string, statField: keyof UserActivityMongo, incrementBy: number) {
    logInfo(`Incrementing user ${userId} activity stat ${statField} by ${incrementBy}`);

    const updateQuery: UpdateQuery<User> = {
      $inc: {
        [`activity.${statField}`]: incrementBy
      }
    };

    await this.userModel.updateOne({ _id: userId }, updateQuery);
  }

  /**
   * Calculate age from birthdate
   * @param birthDate: date
   ** return: age
   */
  calculateAgeFromBirthDate = (birthDate: Date) => {
    const today_date = getCurrentDate();
    const today_year = today_date.getFullYear();
    const today_month = today_date.getMonth() + 1; // Note: January is 0 using getMonth
    const today_day = today_date.getDate();
    let age = today_year - birthDate.getFullYear();

    //logInfo("today_year = "+today_year+", today_month = "+today_month+", today_day = "+today_day);
    //logInfo("birthdate_year = "+birthDate.getFullYear()+", birthdate_month = "+(birthDate.getMonth()+1)+", birthdate_day = "+birthDate.getDate());

    if (today_month < birthDate.getMonth() + 1) {
      age--;
    }
    if (birthDate.getMonth() + 1 == today_month && today_day < birthDate.getDate()) {
      age--;
    }
    return age;
  };

  async markSocialNetworkJoined(userId: string, socialNetwork: SocialNetworkType) {
    logInfo("Marking user " + userId + " as joined social network " + socialNetwork);

    // Check if socialNetwork is valid
    const validSocialNetworks: SocialNetworkType[] = ["facebook", "bluesky", "instagram", "linkedin", "discord"];
    if (!validSocialNetworks.includes(socialNetwork)) {
      throw new BadRequestException(`Invalid social network: ${socialNetwork}`);
    }

    // Add the current date to the user's socialNetworks field (only if it has not been added yet)
    await this.userModel.updateOne(
      { _id: userId, [`socialNetworks.${socialNetwork}`]: { $exists: false } },
      { $set: { [`socialNetworks.${socialNetwork}`]: getCurrentDate().getTime() } }
    );

    // Check user's missions
    this.eventEmitter.emit(InternalEventsEnum.USER_CHECK_MISSIONS_FOR_USER, { userId: userId });
  }

  async markAppStoreReview(userId: string, store: AppStoreType) {
    logInfo("Marking user " + userId + " as made an app store review on " + store);

    // Check if store is valid
    const validStores: AppStoreType[] = ["ios", "android"];
    if (!validStores.includes(store)) {
      throw new BadRequestException(`Invalid store: ${store}`);
    }

    // Add the current date to the user's appStoreReviews field (only if it has not been added yet)
    await this.userModel.updateOne(
      { _id: userId, [`appStoreReviews.${store}`]: { $exists: false } },
      { $set: { [`appStoreReviews.${store}`]: getCurrentDate().getTime() } }
    );

    // Check user's missions
    this.eventEmitter.emit(InternalEventsEnum.USER_CHECK_MISSIONS_FOR_USER, { userId: userId });
  }

  async updateAvatar(userId: string, avatarId: string) {
    logInfo("Updating avatar for user " + userId + " with ID: " + avatarId);

    await this.userModel.updateOne({ _id: userId }, { $set: { avatar: avatarId } });

    // Check user's missions
    this.eventEmitter.emit(InternalEventsEnum.USER_CHECK_MISSIONS_FOR_USER, { userId: userId });
  }

  async cacheTerritoriesForUsers(): Promise<void> {
    try {
      const users = await this.userModel.find({
        territories: { $exists: false },
        removedAccountDate: { $exists: false } // Make sure we do not process users that removed their account
      });

      logInfo(`Caching territories for ${users.length} users that do not have it yet`);

      for (const user of users) {
        if (user.pollingStationId) {
          const territories = await this.countryModelService.getParentTerritoriesFrom(user.pollingStationId);
          logInfo(`User ${user._id} territories: ${JSON.stringify(territories)}`);

          // Store territories in user document
          await this.userModel.updateOne({ _id: user._id }, { $set: { territories: territories } });
        }
      }
    } catch (error) {
      logError("Error caching territories for users:", error);
      throw new Error("Failed to cache territories for users");
    }
  }

  async updateTotalNumberOfCitizens(): Promise<number> {
    try {
      // Count citizen who have completed their profile (not VISITOR or USER_INCOMPLETE)
      // Also exclude users with a @yopmail.com as we use this domain for tests
      // Also exclude users that removed their account
      const totalNumberOfCitizens = await this.userModel.countDocuments({
        role: { $nin: [Role.VISITOR, Role.USER_INCOMPLETE] },
        key: { $not: /#yopmail\.com$/ },
        removedAccountDate: { $exists: false }
      });

      logInfo(`Updating global citizens_number to ${totalNumberOfCitizens}`);

      await this.globalService.setGlobal<number>(GlobalKey.CITIZENS_NUMBER, totalNumberOfCitizens);

      return totalNumberOfCitizens;
    } catch (error) {
      logError("Error updating total number of citizens:", error);
      throw new Error("Failed to update total number of citizens");
    }
  }

  /************************** MENTOR ID MANAGEMENT  ************************************/

  /**
   * Generate mentor invitation code for all users that do not have one
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {Error} If an error occurs during the operation.
   */
  async generateMentorInvitationCodeForAllUsers(): Promise<void> {
    try {
      const users = await this.userModel.find({
        mentorInvitationCode: { $exists: false },
        removedAccountDate: { $exists: false } // Make sure we do not process users that removed their account
      });

      for (const user of users) {
        const mentorInvitationCode = await this.generateMentorInvitationCode(user._id.toString());
      }
    } catch (error) {
      logError("Error generating mentor Invitation code for all users:", error);
      throw new Error("Failed to generate mentor invitation code for all users");
    }
  }

  /**
   * Generate a unique mentor invitation code for a user and store it in the database.
   * Note: should be called only once for each user (usually during user creation)
   * @param {string} userId - The ID of the user for whom to generate the mentor invitation code.
   * @returns {Promise<string>} A promise that resolves to the generated mentor invitation code.
   */
  async generateMentorInvitationCode(userId: string): Promise<string> {
    try {
      // Generate a unique mentor ID
      const mentorInvitationCode = await this.generateUniqueMentorInvitationCode();

      // Update the user with the generated mentor ID
      await this.userModel.updateOne({ _id: userId }, { $set: { mentorInvitationCode } });

      logInfo("Mentor ID generated for user:", userId, " - Mentor invitation code:", mentorInvitationCode);

      return mentorInvitationCode;
    } catch (error) {
      logError("Error generating mentor invitation code for user:", error);
      throw new Error("Failed to generate mentor invitation code");
    }
  }

  /**
   * Generate a unique mentor invitation code.
   * Use global "nextUserId" counter to generate a mentor ID + increment it
   * to ensure uniqueness across all users.
   * @returns {Promise<string>} A promise that resolves to the generated mentor ID.
   */
  private async generateUniqueMentorInvitationCode(): Promise<string> {
    try {
      let nextUserId = await this.globalService.getGlobal<number>(GlobalKey.NEXT_USER_ID);
      if (nextUserId === undefined) {
        nextUserId = 0;
      }

      // Immediately increment the global counter for the next user ID
      await this.globalService.setGlobal<number>(GlobalKey.NEXT_USER_ID, nextUserId + 1);

      return encodeBase28(nextUserId);
    } catch (error) {
      logError("Error generating unique mentor invitation code:", error);
      throw new Error("Failed to generate unique mentor invitation code");
    }
  }

  public async validateMentorInvitationCode(mentorInvitationCode: string): Promise<boolean> {
    // If mentorInvitationCode is less than 3 characters, it cannot exists
    if (!mentorInvitationCode || mentorInvitationCode.length < 3) {
      return false;
    }

    // Check if the mentor invitation correspond to a valid user in DB
    if ((await this.userModel.exists({ mentorInvitationCode: mentorInvitationCode })) !== null) {
      return true;
    }

    // If we reach this point, the mentor invitation code is not valid
    return false;
  }

  /************************** CRITICAL ACTIONS (CHANGE EMAIL, ACCOUNT REMOVAL, ....) MANAGEMENT  ************************************/

  /**
   * Generate a unique code for critical actions (e.g., email change, account removal).
   * Note: there is only one valid code at a time for a user (new code invalidates previous one)
   * @param userId
   */
  private async generateCriticalActionCode(userId: string): Promise<string> {
    try {
      // Generate a unique code
      const code = generateVerificationCode();

      logInfo("generateCriticalActionCode: generating code " + code + " for " + userId);

      // Update user in DB
      await this.userModel.updateOne(
        { _id: userId },
        { $set: { criticalActionValidationCode: { code, time: Date.now() } } }
      );

      return code;
    } catch (error) {
      logError("Error generating critical action code for user:", error);
      throw new Error("Failed to generate critical action code");
    }
  }

  private async checkCriticalActionCode(userId: string, code: string): Promise<boolean> {
    try {
      const user = await this.userModel.findById(userId, { criticalActionValidationCode: 1 });

      if (!user) {
        logError("checkCriticalActionCode: cannot find user " + userId);
        return false;
      }

      if (!user.criticalActionValidationCode) {
        logError("checkCriticalActionCode: user " + userId + " has no criticalActionValidationCode");
        return false;
      }

      if (user.criticalActionValidationCode.code != code) {
        logError("checkCriticalActionCode: user " + userId + " provided invalid code " + code);

        // In this case, we invalidate the code to avoid brute force
        await this.userModel.updateOne({ _id: userId }, { $unset: { criticalActionValidationCode: "" } });

        return false;
      }

      // Check if code is not too old (validity = 15 minutes)
      const codeAge = Date.now() - user.criticalActionValidationCode.time;
      if (codeAge > 15 * 60 * 1000) {
        logError("checkCriticalActionCode: user " + userId + " provided expired code " + code);

        // In this case, we invalidate the code to avoid brute force
        await this.userModel.updateOne({ _id: userId }, { $unset: { criticalActionValidationCode: "" } });

        return false;
      }

      // If we reach this point, the code is valid (and we invalidate it to avoid reuse)
      await this.userModel.updateOne({ _id: userId }, { $unset: { criticalActionValidationCode: "" } });

      return true;
    } catch (error) {
      logError("Error checking critical action code for user:", error);
      throw new Error("Failed to check critical action code");
    }
  }

  /** User ask for its account removal
   * @summary User ask for its account removal
   * @param {string} userId - The ID of the user whose account is being removed.
   * @returns {void}
   */
  public async removeAccount(userId: string): Promise<void> {
    logInfo("User " + userId + " asked for its account removal");

    // Generate a code & store it in DB
    const code = await this.generateCriticalActionCode(userId);

    // Send an email to user with this code
    const user = await this.userModel.findById(userId, { email: 1, firstName: 1 });

    if (!user) {
      throw new Error("Cannot find user " + userId);
    }

    await this.emailService.sendMail({
      dynamicTemplateData: {
        code: code
      },
      templateId: "code_to_remove_account",
      to: user.email
    });

    logInfo("Account removal code sent by email to user " + userId);
  }

  /** User confirm its account removal by providing the code received by email
   * @summary User confirm its account removal by providing the code received by email
   * @param {string} userId - The ID of the user whose account is being removed.
   * @param {string} code - The code received by email to confirm account removal.
   * @param {User} user - User who requested the account removal (used for admin features)
   * @returns {void}
   */
  public async confirmRemoveAccount(userId: string, code: string, requested_by: User): Promise<void> {
    logInfo("User " + userId + " is confirming its account removal with code " + code);

    if (requested_by.role == Role.ADMIN) {
      // Admin is requesting the account removal for this user => skip code check
      logInfo("User " + userId + " account removal is requested by an admin, skipping code check");
    } else {
      // User is requesting its own account removal => check code
      if (!(await this.checkCriticalActionCode(userId, code))) {
        throw new BadRequestException("Invalid code");
      }

      logInfo("User " + userId + " provided a valid code to confirm its account removal");
    }

    // Remove all user data (chat messages, votes, ...)
    await this.removeUserAccount(userId);
  }

  private async removeUserAccount(userId: string): Promise<void> {
    logInfo("Removing account for user " + userId);

    // Get user data
    const user = await this.getUserCompleteById(userId);

    // Add this user to "deleted users" list
    // = make sure this user cannot register again with the same email or phone number during the next 7 days to avoid double votes
    await this.deletedUserModel.create({
      key: user.key,
      phoneNumber: user.phoneNumber,
      deletedAt: getCurrentDate().getTime()
    });

    // Change public name to "Deleted user" on chat server
    await this.chatserviceService.updatePublicName(user._id, "Deleted user");

    // Set user as deleted + remove all personal data
    await this.userModel.updateOne(
      { _id: userId },
      {
        $set: {
          removedAccountDate: getCurrentDate().getTime(),
          email: "deleted_" + crypto.randomUUID(),
          key: "deleted_" + crypto.randomUUID(),
          phoneNumber: undefined, // (remove this field)
          firstName: undefined,
          publicName: "Deleted user",
          lastName: undefined,
          matrixSecret: undefined
        }
      }
    );

    // Finally (less critical), remove this user from Sendgrid asynchronously
    this.emailService.removeUserFromSendgrid(user.email);

    logInfo("All data for user " + userId + " has been removed");
  }

  /**
   * Generate missing fields (recently added) for all users in the database.
   * Note: this is a one-time operation to fix missing data in DB
   * @returns {Promise<void>} A promise that resolves when the operation is complete.
   * @throws {Error} If an error occurs during the operation.
   */

  public async createMissingFieldsForAllUsers(): Promise<void> {
    try {
      const users = await this.userModel.find({ key: { $exists: false } });
      for (const user of users) {
        user.key = emailToKey(user.email);
        logInfo(`Generating key for user ${user._id}: ${user.email} -> ${user.key}`);

        // If "creationDate" is not set, we set it to current date (this should not happen anymore)
        if (!user.creationDate) {
          logInfo("User " + user._id + " has no creationDate, setting it to current date");
          user.creationDate = getCurrentDate().getTime();
        }

        // If "lastSession" is not set, we set it to most recent session from devices (if any)
        if (!user.lastSession && user.devices) {
          let mostRecentSession = 0;
          for (const deviceId in user.devices) {
            if (user.devices[deviceId].lastSession && user.devices[deviceId].lastSession > mostRecentSession) {
              mostRecentSession = user.devices[deviceId].lastSession;
            }
          }
          if (mostRecentSession > 0) {
            logInfo(
              "User " +
                user._id +
                " has no lastSession, setting it to most recent session from devices: " +
                mostRecentSession
            );
            user.lastSession = mostRecentSession;
          } else {
            logInfo("User " + user._id + " has no lastSession and no device sessions, setting it to current date");
            user.lastSession = getCurrentDate().getTime();
          }
        } else {
          user.lastSession = getCurrentDate().getTime();
        }

        await user.save();
      }
    } catch (error) {
      logError("Error generating email_normalized for all users:", error);
      throw new Error("Failed to generate email_normalized for all users");
    }

    logInfo("createMissingFieldsForAllUsers: All missing fields have been generated for all users");
  }

  /**
   * Update users count for each territory
   * Count users (registered with complete profile / excluding visitors, incomplete users, and removed accounts) for each territory and
   * store it in each corresponding territory.
   */
  public async updateUsersCountPerTerritory() {
    const user_filter = {
      role: { $nin: [Role.VISITOR, Role.USER_INCOMPLETE] }, // Exclude visitors and incomplete users
      key: { $not: /#yopmail\.com$/ }, // Exclude fake users
      removedAccountDate: { $exists: false } // Exclude deleted accounts
    };

    const aggregation_pipeline = [
      {
        $match: user_filter // Filter users
      },
      {
        $project: {
          // Transform territories object to array of key/value pairs
          pairs: {
            $objectToArray: "$territories"
          }
        }
      },
      {
        $unwind: "$pairs" // Unwind array to have one document per territory
      },
      {
        $group: {
          // Group by territory ID + count users
          _id: "$pairs.v",
          count: {
            $sum: 1
          }
        }
      },
      {
        $project: {
          _id: 0,
          territory: "$_id",
          count: 1
        }
      }
    ];

    const userCountByTerritory: { territory: string; count: number }[] = await this.userModel
      .aggregate(aggregation_pipeline)
      .exec();

    logDebug("User count by territory:", userCountByTerritory);
    await this.countryModelService.updateUserCountByTerritory(userCountByTerritory);
    logInfo("updateUsersCountPerTerritory: Users count per territory has been updated");
  }
}
