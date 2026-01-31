// Roles are the most basic rights management system for Baztille

export enum Role {
  // Unregistered user, or user who provide an unconfirmed email
  // User with no authentication token are at this level
  VISITOR = "VISITOR",

  // User with verified email but missing mandatory info (city, public name)
  // Can access their own info, login, logout, delete account, update profile
  USER_INCOMPLETE = "USER_INCOMPLETE",

  // Registered user with complete profile
  // Not a member of the association, so cannot vote
  // Note: a user should have at least a verified email, city, and public name
  USER = "USER",

  // Baztille member
  // Member of the association (= can vote)
  // Note: a member should have at least a verified email+phone and a first name / last name
  MEMBER = "MEMBER",

  // Baztille moderator
  // User with extra rights (not used at now)
  MODERATOR = "MODERATOR", // moderator

  // Baztille admin
  // Only for sysops
  ADMIN = "ADMIN"
}
