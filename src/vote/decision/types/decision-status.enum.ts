export enum DecisionStatus {
  // Sunday noon: citizens can start submitting & vote subjects (1 citizen can vote for 1 subject max).
  // DEPRECATED : now decision has directly SUGGEST_AND_VOTE_PROPOSAL status
  SUGGEST_AND_VOTE_SUBJECT = "SUGGEST_AND_VOTE_SUBJECT",

  // Starts when a subject is submitted
  // Citizens can start submitting & vote propositions (1 citizen can vote for 1 proposition max) + start debate
  SUGGEST_AND_VOTE_PROPOSAL = "SUGGEST_AND_VOTE_PROPOSAL",

  // the 4 propositions with the most votes are selected for general vote + general vote starts.
  GENERAL_VOTE = "GENERAL_VOTE",

  DECIDED = "DECIDED", // The decision has been taken
  CANCELLED = "CANCELLED" // The decision has not been taken
}
