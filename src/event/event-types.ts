/**
 * Event tracking types and definitions
 * This file is identical for frontend and backend
 *
 * The backend version is in src/resources/event/event-types.ts
 * The frontend version is in src/shared/model/event-types.ts
 *
 * Please update both when making changes.
 * In case of a discrepency, the reference version is the BACKEND version.
 */

export enum PlatformType {
  IOS = "ios",
  ANDROID = "android",
  UNKNOWN = "unknown"
}

/**
 * Event categories
 */

export enum TrackEventCategory {
  REGISTRATION = "registration",
  USER = "user",
  VOTE = "vote",
  CHAT = "chat",
  REFERRAL = "referral",
  MISSION = "mission",
  DEBATE = "debate",
  NAVIGATION = "navigation",
  APP = "app"
}

export const TrackEventCategoryDetails: Record<string, { description: string }> = {
  registration: {
    description: "User registration and onboarding events"
  },
  user: {
    description: "User account and profile events"
  },
  vote: {
    description: "Voting and decision-making events"
  },
  chat: {
    description: "Chat and messaging events"
  },
  referral: {
    description: "User referral events"
  },
  mission: {
    description: "Mission and gamification events"
  },
  debate: {
    description: "Debate events"
  },
  navigation: {
    description: "App navigation and user interface events"
  },
  app: {
    description: "Application lifecycle events"
  }
};

/**
 * All event types
 */

export interface EventTypeDefinition {
  category: TrackEventCategory;
  description: string;
  externalAllowed: boolean; // true if the event can be recorded by external clients using the API, false if backend-only
}

export enum TrackEventType {
  // Registration events
  START_REGISTRATION = "start_registration",
  VISIT_COUNTRY_SELECTION = "visit_country_selection",
  VISIT_CITY_SELECTION = "visit_city_selection",
  CITY_SELECTED = "city_selected", // => go to polling station selection
  POLLING_STATION_SELECTED = "polling_station_selected", // => go to invitaiton code screen (or automatic code detection)
  INVITATION_CODE_ANSWERED = "invitation_code_answered", // Note: may be "none", "detected", "provided"
  VISIT_EMAIL_VERIFICATION = "visit_email_verification",
  CREATE_USER = "create_user", // User request to create account (email not verified at now)
  EMAIL_VERIFIED = "email_verified",
  FIRST_GENERAL_VOTE_VISIT = "first_general_vote_visit",
  PHONE_VERIFICATION_REQUESTED = "phone_verification_requested",
  PHONE_VERIFIED = "phone_verified",
  START_VIEWING_GLOBAL_PLAN = "start_viewing_global_plan",
  VISIT_GLOBAL_PLAN_PAGE = "visit_global_plan_page",
  NOT_INTERESTED_IN_PLAN = "not_interested_in_plan",
  USER_CONVINCED = "user_convinced",

  VISIT_LOGIN_PAGE = "visit_login_page",
  USER_LOGIN = "user_login",
  USER_AUTHENTICATED = "user_authenticated",

  // User management events

  // Voting events
  GENERAL_VOTE = "general_vote",

  // Chat and messaging events

  // Referral events
  SHARE_INVITATION = "share_invitation",
  SHARE_VOTE = "share_vote",

  // Mission and gamification events
  MISSION_COMPLETED = "mission_completed",
  MISSION_COLLECTED = "mission_collected",
  LEVEL_UP = "level_up",

  // Debate
  ARGUMENT_VOTED = "argument_voted",
  FIRST_DEBATE_VISIT = "first_debate_visit",

  // App navigation and UI events

  // App lifecycle events
  TEST_EVENT = "test_event"
}

export const TrackEventTypesDetails: Record<string, EventTypeDefinition> = {
  /////////////////////////////////
  // Registration events
  /////////////////////////////////

  start_registration: {
    category: TrackEventCategory.REGISTRATION,
    description:
      "User started the registration process (first welcome registration screen), or open the app while not logged in",
    externalAllowed: true
  },
  visit_country_selection: {
    category: TrackEventCategory.REGISTRATION,
    description: "User visited the country selection screen during registration",
    externalAllowed: true
  },
  visit_city_selection: {
    category: TrackEventCategory.REGISTRATION,
    description: "User visited the city selection screen during registration",
    externalAllowed: true
  },
  city_selected: {
    category: TrackEventCategory.REGISTRATION,
    description: "User selected and validated their city during registration",
    externalAllowed: true
  },
  polling_station_selected: {
    category: TrackEventCategory.REGISTRATION,
    description: "User selected and validated their polling station during registration",
    externalAllowed: true
  },
  invitation_code_answered: {
    category: TrackEventCategory.REGISTRATION,
    description:
      "User answer he has no invitation code (status=none), or enter a code (status=provided), or the code was automatically detected (status=detected)",
    externalAllowed: true
  },
  visit_email_verification: {
    category: TrackEventCategory.REGISTRATION,
    description: "User visited the email verification screen during registration",
    externalAllowed: true
  },
  create_user: {
    category: TrackEventCategory.REGISTRATION,
    description: "New account created",
    externalAllowed: false
  },
  email_verified: {
    category: TrackEventCategory.REGISTRATION,
    description: "User verified their email address (using code)",
    externalAllowed: false
  },
  first_general_vote_visit: {
    category: TrackEventCategory.REGISTRATION,
    description: "General vote tutorial shown (after a click on Vote button)",
    externalAllowed: true
  },
  phone_verification_requested: {
    category: TrackEventCategory.REGISTRATION,
    description: "User visits page where we request phone verification (before sending code)",
    externalAllowed: true
  },
  phone_verified: {
    category: TrackEventCategory.REGISTRATION,
    description: "User verified their phone number (using code)",
    externalAllowed: false
  },
  start_viewing_global_plan: {
    category: TrackEventCategory.REGISTRATION,
    description:
      "User started viewing the global plan during onboarding (caroussel: steps to make our decision applied)",
    externalAllowed: true
  },
  visit_global_plan_page: {
    category: TrackEventCategory.REGISTRATION,
    description: 'User visited the global plan page during onboarding (property "page" indicates which subpage)',
    externalAllowed: true
  },
  not_interested_in_plan: {
    category: TrackEventCategory.REGISTRATION,
    description:
      'User indicated they are not interested in the plan ("I just want to vote" button) at the end of the plan view',
    externalAllowed: true
  },
  user_convinced: {
    category: TrackEventCategory.REGISTRATION,
    description: "User indicated they are convinced about the plan during onboarding",
    externalAllowed: false
  },
  visit_login_page: {
    category: TrackEventCategory.REGISTRATION,
    description: "User visited the login page",
    externalAllowed: true
  },
  user_login: {
    category: TrackEventCategory.REGISTRATION,
    description: "User logged in (note: a registration is not tracked as a login)",
    externalAllowed: false
  },

  ///////////////////////////////////
  // User management events
  ///////////////////////////////////

  user_authenticated: {
    category: TrackEventCategory.USER,
    description: "User is logged in in the app, after logged in or after registration",
    externalAllowed: false
  },

  ///////////////////////////////////
  // Voting events
  ///////////////////////////////////

  general_vote: {
    category: TrackEventCategory.VOTE,
    description: "User cast a general vote",
    externalAllowed: false
  },

  ///////////////////////////////////
  // Chat and messaging events
  ///////////////////////////////////

  ///////////////////////////////////
  // Referral events
  ///////////////////////////////////

  share_invitation: {
    category: TrackEventCategory.REFERRAL,
    description: "User tapped on share invitation button",
    externalAllowed: true
  },
  share_vote: {
    category: TrackEventCategory.REFERRAL,
    description: "User shared a vote (from vote results screen)",
    externalAllowed: true
  },

  ///////////////////////////////////
  // Mission and gamification events
  ///////////////////////////////////

  mission_completed: {
    category: TrackEventCategory.MISSION,
    description: "User completed a mission",
    externalAllowed: false
  },
  mission_collected: {
    category: TrackEventCategory.MISSION,
    description: "User collected the points for a completed mission",
    externalAllowed: false
  },
  level_up: {
    category: TrackEventCategory.MISSION,
    description: "User leveled up",
    externalAllowed: false
  },

  ///////////////////////////////////
  // Debate
  ///////////////////////////////////

  argument_voted: {
    category: TrackEventCategory.DEBATE,
    description: "User voted on a debate argument",
    externalAllowed: false
  },
  first_debate_visit: {
    // Not implemented
    category: TrackEventCategory.DEBATE,
    description: "User visited the debate section for the first time",
    externalAllowed: true
  },

  ///////////////////////////////////
  // App navigation and UI events
  ///////////////////////////////////

  ///////////////////////////////////
  // App lifecycle events
  ///////////////////////////////////

  test_event: {
    category: TrackEventCategory.APP,
    description: "Used for testing the event tracking system",
    externalAllowed: true
  }
};
