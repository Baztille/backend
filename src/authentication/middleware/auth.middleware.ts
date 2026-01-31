import { Injectable, NestMiddleware } from "@nestjs/common";
import { NextFunction, Request, Response } from "express";
import { ObjectId } from "mongoose";
import { ClsService } from "nestjs-cls";
import { Role } from "src/common/enum";
import { Territory } from "src/countrymodel/types/territory.type";
import { UserDiscoverStep } from "src/profile/user/types/user-discover-step.enum";
import { User } from "src/profile/user/types/user.type";
import {
  AppStoreType,
  RecruitActivityMongo,
  SocialNetworkType,
  UserActivityMongo,
  UserDeviceMongo,
  UserEmailOptionMongo,
  UserMissionCompletedMongo
} from "src/profile/user/user.schema";
import { UserService } from "src/profile/user/user.service";
import { getCurrentDate } from "src/utils/date-time";
import { AuthService } from "../auth/auth.service";

export interface ApiRequest extends Request {
  user: User;
  deviceId?: string;
  platform: "ios" | "android" | "web" | "unknown";
  appVersion?: string;
}

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private authService: AuthService,
    private userService: UserService,
    private readonly clsService: ClsService
  ) {}

  async use(req: ApiRequest, res: Response, next: NextFunction) {
    let bFailedToAuthenticate = false;

    try {
      const token = req.headers.authorization?.split(" ")[1];

      if (token) {
        // decode token
        const { userId } = this.authService.verifyJwtToken(token);
        const user = await this.userService.getUserCompleteById(userId);
        req.user = user;

        // Use Context Local Storage to pass userId, deviceId, platform and appVersion to services (because req is not injectable in services)
        this.clsService.set("userId", userId);
        this.clsService.set(
          "deviceId",
          req.headers["x-device-id"] ? (req.headers["x-device-id"] as string) : undefined
        );
        this.clsService.set("platform", (req.headers["x-app-platform"] as "ios" | "android" | "web") || "unknown");
        this.clsService.set(
          "appVersion",
          req.headers["x-app-version"] ? (req.headers["x-app-version"] as string) : undefined
        );
      } else {
        bFailedToAuthenticate = true;
      }
    } catch (e) {
      // Failed to authenticate with a token => trying to use the API as anonymous user (= "visitor")
      bFailedToAuthenticate = true;
    }

    if (bFailedToAuthenticate) {
      // Create a dummy "visitor" user
      const min = 10000;
      const max = 99999;
      const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;

      req.user = {
        _id: "00000000000000000000000",
        key: "visitor" + randomNumber.toString() + "#dummy.com",
        email: "visitor" + randomNumber.toString() + "@dummy.com",
        firstName: "Visitor" + randomNumber.toString(),
        lastName: "Visitor",
        publicName: "Visitor" + randomNumber.toString(),
        role: Role.VISITOR,
        emailValidationCode: [],
        emailValidationErrorAttempts: 0,
        creationDate: getCurrentDate().getTime(),
        lastSession: getCurrentDate().getTime(),
        pollingStationId: new Territory(),
        pollingStationHistory: [],
        discoverStep: UserDiscoverStep.NOT_CONVINCED,
        territories: new Map<ObjectId, ObjectId>(),
        territoriesInfos: [],
        devices: new Map<string, UserDeviceMongo>(),
        emailsPrefs: new Map<string, UserEmailOptionMongo>(),
        activity: new UserActivityMongo(),
        socialNetworks: new Map<SocialNetworkType, number>(),
        appStoreReviews: new Map<AppStoreType, number>(),
        points: 0,
        level: 0,
        recruits: new Map<string, RecruitActivityMongo>(),
        missionsCompleted: new Map<string, UserMissionCompletedMongo>()
      };

      // Use Context Local Storage to pass deviceId, platform and appVersion to services (because req is not injectable in services)
      this.clsService.set("userId", null);
      this.clsService.set("deviceId", req.headers["x-device-id"] ? (req.headers["x-device-id"] as string) : undefined);
      this.clsService.set("platform", (req.headers["x-app-platform"] as "ios" | "android" | "web") || "unknown");
      this.clsService.set(
        "appVersion",
        req.headers["x-app-version"] ? (req.headers["x-app-version"] as string) : undefined
      );
    }

    next();
  }
}
