import { logInfo } from "src/utils/logger";
import mongoose from "mongoose";
import { getMongoose } from "./migration.models";
import { log } from "console";

/**
 * Convert all database properties from snake_case to camelCase
 * This migration updates all documents in all collections to use camelCase property names
 *
 * Property mappings:
 * - ballot_box_id -> ballotBoxId
 * - ballot_by_subdivision -> ballotBySubdivision
 * - block_ballot_request_until -> blockBallotRequestUntil
 * - can_vote -> canVote
 * - chatroom_id -> chatroomId
 * - child_ballot_box -> childBallotBox
 * - choice_tiebreaker -> choiceTiebreaker
 * - collection_date -> collectionDate
 * - completion_date -> completionDate
 * - creation_date -> creationDate
 * - debate_end_date -> debateEndDate
 * - decision_date -> decisionDate
 * - discover_step -> discoverStep
 * - display_priority -> displayPriority
 * - display_weight -> displayWeight
 * - emails_prefs -> emailsPrefs
 * - end_time -> endTime
 * - featured_from -> featuredFrom
 * - featured_hotness_trigger_base -> featuredHotnessTriggerBase
 * - featured_to -> featuredTo
 * - general_vote_votesession -> generalVoteVotesession
 * - hotness_score -> hotnessScore
 * - last_vote_time -> lastVoteTime
 * - latest_featured_decision_date -> latestFeaturedDecisionDate
 * - latest_featured_decisions_hotness_trigger -> latestFeaturedDecisionsHotnessTrigger
 * - main_subdivision -> mainSubdivision
 * - matrix_secret -> matrixSecret
 * - max_choices -> maxChoices
 * - min_user_level -> minUserLevel
 * - missions_completed -> missionsCompleted
 * - most_voted_proposition -> mostVotedProposition
 * - most_voted_proposition_at_now -> mostVotedPropositionAtNow
 * - my_notifications_chatroom -> myNotificationsChatroom
 * - next_election_candidate -> nextElectionCandidate
 * - next_territory_subdivision -> nextTerritorySubdivision
 * - official_code -> officialCode
 * - parent_ballot_box -> parentBallotBox
 * - percent_of_votes -> percentOfVotes
 * - polling_station_history -> pollingStationHistory
 * - polling_station_id -> pollingStationId
 * - polling_station_uncertain -> pollingStationUncertain
 * - propositions_selection_date -> propositionsSelectionDate
 * - propositions_selection_votesession -> propositionsSelectionVotesession
 * - registered_users_count -> registeredUsersCount
 * - root_ballot_box -> rootBallotBox
 * - root_territory -> rootTerritory
 * - route_to -> routeTo
 * - security_token -> securityToken
 * - start_time -> startTime
 * - subdivision_id -> subdivisionId
 * - subject_selection_date -> subjectSelectionDate
 * - subject_selection_votesession -> subjectSelectionVotesession
 * - submitted_context -> submittedContext
 * - submitted_propositions -> submittedPropositions
 * - submitted_subjects -> submittedSubjects
 * - territory_to_proposition -> territoryToProposition
 * - text_id -> textId
 * - total_votes_count -> totalVotesCount
 * - type_arg -> typeArg
 * - user_has_voted -> userHasVoted
 * - user_id -> userId
 * - user_voted -> userVoted
 * - valid_until -> validUntil
 * - votable_decisions -> votableDecisions
 * - votable_territory -> votableTerritory
 * - vote_cycle -> voteCycle
 * - voters_count -> votersCount
 * - votes_count -> votesCount
 * - votes_maintenance_message -> votesMaintenanceMessage
 * - votes_nbr -> votesNbr
 * - votes_sum -> votesSum
 * - voting_activity -> votingActivity
 * - voting_session_id -> votingSessionId
 */

const propertyMappings = {
  ballot_box_id: "ballotBoxId",
  ballot_by_subdivision: "ballotBySubdivision",
  block_ballot_request_until: "blockBallotRequestUntil",
  can_vote: "canVote",
  chatroom_id: "chatroomId",
  child_ballot_box: "childBallotBox",
  choice_tiebreaker: "choiceTiebreaker",
  collection_date: "collectionDate",
  completion_date: "completionDate",
  creation_date: "creationDate",
  debate_end_date: "debateEndDate",
  decision_date: "decisionDate",
  discover_step: "discoverStep",
  display_priority: "displayPriority",
  display_weight: "displayWeight",
  emails_prefs: "emailsPrefs",
  end_time: "endTime",
  featured_from: "featuredFrom",
  featured_hotness_trigger_base: "featuredHotnessTriggerBase",
  featured_to: "featuredTo",
  general_vote_votesession: "generalVoteVotesession",
  hotness_score: "hotnessScore",
  last_vote_time: "lastVoteTime",
  latest_featured_decision_date: "latestFeaturedDecisionDate",
  latest_featured_decisions_hotness_trigger: "latestFeaturedDecisionsHotnessTrigger",
  main_subdivision: "mainSubdivision",
  matrix_secret: "matrixSecret",
  max_choices: "maxChoices",
  min_user_level: "minUserLevel",
  missions_completed: "missionsCompleted",
  most_voted_proposition: "mostVotedProposition",
  my_notifications_chatroom: "myNotificationsChatroom",
  next_election_candidate: "nextElectionCandidate",
  next_territory_subdivision: "nextTerritorySubdivision",
  official_code: "officialCode",
  parent_ballot_box: "parentBallotBox",
  polling_station_history: "pollingStationHistory",
  polling_station_id: "pollingStationId",
  polling_station_uncertain: "pollingStationUncertain",
  propositions_selection_date: "propositionsSelectionDate",
  propositions_selection_votesession: "propositionsSelectionVotesession",
  registered_users_count: "registeredUsersCount",
  root_ballot_box: "rootBallotBox",
  root_territory: "rootTerritory",
  route_to: "routeTo",
  security_token: "securityToken",
  start_time: "startTime",
  subdivision_id: "subdivisionId",
  subject_selection_date: "subjectSelectionDate",
  subject_selection_votesession: "subjectSelectionVotesession",
  submitted_context: "submittedContext",
  submitted_propositions: "submittedPropositions",
  submitted_subjects: "submittedSubjects",
  territory_to_proposition: "territoryToProposition",
  text_id: "textId",
  total_votes_count: "totalVotesCount",
  type_arg: "typeArg",
  user_has_voted: "userHasVoted",
  user_id: "userId",
  user_voted: "userVoted",
  valid_until: "validUntil",
  votable_decisions: "votableDecisions",
  votable_territory: "votableTerritory",
  vote_cycle: "voteCycle",
  voters_count: "votersCount",
  votes_count: "votesCount",
  votes_maintenance_message: "votesMaintenanceMessage",
  votes_nbr: "votesNbr",
  votes_sum: "votesSum",
  voting_activity: "votingActivity",
  voting_session_id: "votingSessionId"
};

async function renameFieldsInCollection(
  db: mongoose.mongo.Db,
  collectionName: string,
  fieldMappings: Record<string, string>
) {
  logInfo(` Renaming fields in collection: ${collectionName}`);

  const collection = db.collection(collectionName);

  const renameOps: Record<string, string> = {};
  const unsetOps: string[] = [];

  for (const [oldName, newName] of Object.entries(fieldMappings)) {
    //logInfo(`  - Preparing to rename field: ${oldName} -> ${newName}`);
    renameOps[oldName] = newName;
  }

  if (Object.keys(renameOps).length === 0) {
    return 0;
  }

  // Build update operation
  const updateOp: any = {
    $rename: renameOps
  };

  // Update all documents in the collection
  const result = await collection.updateMany({}, updateOp);
  //logInfo(`  - Renamed fields in ${result.modifiedCount} documents.`);

  return result.modifiedCount;
}

async function up() {
  logInfo("🚀🚀 Converting all database properties from snake_case to camelCase...");

  const db = (await getMongoose()).connection.db;
  const collections = await db.listCollections().toArray();

  let totalUpdated = 0;

  for (const collectionInfo of collections) {
    const collectionName = collectionInfo.name;

    // Skip system collections
    if (collectionName.startsWith("system.")) {
      continue;
    }

    logInfo(`Processing collection: ${collectionName}`);

    try {
      const updated = await renameFieldsInCollection(db, collectionName, propertyMappings);
      totalUpdated += updated;

      if (updated > 0) {
        logInfo(`  ✅ Updated ${updated} documents in ${collectionName}`);
      } else {
        logInfo(`  ℹ️  No documents updated in ${collectionName}`);
      }
    } catch (error) {
      logInfo(`  ⚠️  Error processing ${collectionName}: ${error.message}`);
      throw error;
    }
  }

  logInfo(`✅ Property name conversion completed. Total documents updated: ${totalUpdated}`);
}

async function down() {
  logInfo("🚀🚀 Reverting camelCase properties back to snake_case...");

  // Create reverse mappings
  const reverseMappings: Record<string, string> = {};
  for (const [snakeCase, camelCase] of Object.entries(propertyMappings)) {
    reverseMappings[camelCase] = snakeCase;
  }

  const db = (await getMongoose()).connection.db;
  const collections = await db.listCollections().toArray();

  let totalReverted = 0;

  for (const collectionInfo of collections) {
    const collectionName = collectionInfo.name;

    // Skip system collections
    if (collectionName.startsWith("system.")) {
      continue;
    }

    logInfo(`Reverting collection: ${collectionName}`);

    try {
      const reverted = await renameFieldsInCollection(db, collectionName, reverseMappings);
      totalReverted += reverted;

      if (reverted > 0) {
        logInfo(`  ✅ Reverted ${reverted} documents in ${collectionName}`);
      } else {
        logInfo(`  ℹ️  No documents reverted in ${collectionName}`);
      }
    } catch (error) {
      logInfo(`  ⚠️  Error reverting ${collectionName}: ${error.message}`);
      throw error;
    }
  }

  logInfo(`✅ Property name reversion completed. Total documents reverted: ${totalReverted}`);
}

module.exports = { up, down };
