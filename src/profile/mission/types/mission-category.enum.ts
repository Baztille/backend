/*
 *
 *   Mission category
 *
 *   A mission category group missions that are related to the same progression direction
 *
 */

export enum MissionCategory {
  DISCOVER = "DISCOVER", // Discover the app and its features
  REFERRAL = "REFERRAL", // Recrute citizen to join the app
  ENGAGE = "ENGAGE", // Engage with the app and its features (ex: Vote, Propose, etc.)
  COMMUNITY = "COMMUNITY", // Perform actions that benefit the community, beyond the actions that everyone could do (ex: report to moderator, moderation action, judge, corrector, translation...)
  FINANCE = "FINANCE", // Help Baztille financially
  ACTION = "ACTION" // Perform IRL actions that benefit the movement
}
