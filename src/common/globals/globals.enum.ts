/*
 **
 * Global list
 *
 */

export enum GlobalKey {
  ///// Globals variables for general use /////

  // Next user ID to be assigned (used for mentor ID generation)
  NEXT_USER_ID = 1001,

  // Last event that have been send to the analytics system
  LAST_EVENT_SENT_TO_ANALYTICS = 1002,

  ///// Globals for missions //////
  MAX_VOTERS_FIVE_LAST_DECISIONS = 100001,
  CITIZENS_NUMBER = 100002 // Note: citizens which have validated their email (= not VISITOR)
}
