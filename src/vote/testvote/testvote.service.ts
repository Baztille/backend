import { BadRequestException, Injectable, InternalServerErrorException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";

import { User } from "src/profile/user/types/user.type";
import { UserMongo } from "src/profile/user/user.schema";
import { DecisionService } from "../decision/decision.service";
import { CreateProposalDto } from "../decision/dto/create-proposal.dto";
import { CreateSubjectDto } from "../decision/dto/create-subject.dto";
import { VotingSessionService } from "../voting-session/voting-session.service";

import { COUNTRY_TERRITORY_ID } from "src/countrymodel/types/territory.type";
import { DebateContextService } from "src/debate/debate-context.service";
import { getCurrentDate } from "src/utils/date-time";
import { logInfo } from "src/utils/logger";
import { DecisionStatus } from "../decision/types/decision-status.enum";
import { SubjectTheme } from "../decision/types/subject-theme.enum";
import { BallotDto } from "../voting-session/voting-session.dto";

export type TestVoteEvent =
  | "start_new"
  | "subject_selection"
  | "proposition_selection"
  | "end_vote"
  | "init_debatecontext";
export type TestVoteAction =
  | "submit_subjects"
  | "submit_propositions"
  | "vote_subjects"
  | "vote_propositions"
  | "vote_general"
  | "votesession_create"
  | "votesession_ballot_request"
  | "votesession_vote"
  | "votesession_mass_vote"
  | "votesession_close";

@Injectable()
export class TestVoteService {
  constructor(
    @InjectModel(UserMongo.name) private readonly userModel: Model<UserMongo>,
    private readonly decisionService: DecisionService,
    private readonly votingSessionService: VotingSessionService,
    private readonly debateContextService: DebateContextService
  ) {}

  /********************* Testing lifecycle functions (for dev only) *******************/

  /**
   * Trigger a fake vote action to test vote cycle (for dev purpose only). Possible actions: \
   * @param {string} action Possible actions: 
      submit_subjects: Submit subjects (vote step 1) 
      submit_propositions: Submit propositions (vote step 2) 
      vote_subjects: Vote for random subjects (vote step 1) DEPRECATED
      vote_propositions: Vote for random propositions (vote step 2) 
      vote_general: Vote for random selectedpropositions (vote step 3) 
   * @returns {bool} true if success
   */

  async voteTest(action: TestVoteAction, user: User, test_voting_session?: string): Promise<any> {
    logInfo("Triggering test vote action: " + action);

    ////////////////////////////////////////////////////:
    ///// Submit subjects
    if (action == "submit_subjects") {
      // Find current compatible decision
      const decision = await this.decisionService.getCurrentDecision(DecisionStatus.SUGGEST_AND_VOTE_SUBJECT);

      if (!decision) {
        throw new InternalServerErrorException("No active decision for submitting subjects");
      }
      logInfo("Decision found: " + decision._id);

      const subjects = [
        "Le dossier des retraites",
        "L'énergie nucléaire civile",
        "L'imposition des grandes fortunes",
        "La durée légale du travail",
        "La durée du mandat présidentiel",
        "Le salaire minimum",
        "Le cannabis",
        "L'accueil des migrants",
        "La chasse",
        "Le maintien du pouvoir d'achat",
        "La durée limite de l'IVG",
        "L'usage du référendum",
        "L'impôt sur le revenu",
        "Les minimas sociaux",
        "Le nombre de fonctionnaires",
        "Le pétrole et le gaz Russes",
        "La priorité pour les prisons",
        "La TVA",
        "L'imposition des héritages",
        "La priorité dans nos relations avec l'UE",
        "Les aides à l'achat d'automobiles neuves / L'interdiction de ventes des automobiles polluantes",
        "La promotion de la culture",
        "La gestion des frontière de l'Europe",
        "La construction d'éoliennes",
        "Le renouveau du transport ferroviaire",
        "La baisse des émissions de CO2",
        "La place de la religion dans l'espace public",
        "L'amélioration de la qualité de l'alimentation",
        "La lutte contre la précarité des jeunes travailleurs",
        "La lutte contre la fraude fiscale et sociale",
        "La gestion de la fin de vie",
        "L'inclusion des personnes handicapées",
        "L'amélioration du fonctionnement de la police",
        "Le statut de la Corse",
        "L'amélioration de l'hopital public",
        "La revalorisation du métier d'enseignant",
        "L'amélioration de la qualité de vie des personnes âgées en perte d'autonomie",
        "Le logement social",
        "La place de la France vis à vis de l'OTAN",
        "La position de la France dans la guerre en Ukraine"
      ];

      // Get 20 random users from DB
      const users = await this.userModel.aggregate([{ $sample: { size: 20 } }]);

      // Randomize subjects and get the 20 first
      subjects.sort(() => Math.random() - 0.5);

      for (let i = 0; i < 20; i++) {
        const subject_label = subjects[i];
        const userId = users.pop()._id;
        logInfo("Inserting subject: " + subject_label + " by user " + userId);

        const subject: CreateSubjectDto = {
          title: subject_label,
          theme: SubjectTheme.ECONOMY
        };
        await this.decisionService.submitSubject(subject, user);
      }
    }

    ////////////////////////////////////////////////////:
    ///// Vote subjects
    else if (action == "vote_subjects") {
      // Find current compatible decision
      // DEPRECATED: this not how we are choosing subjects anymore
      /*  let decision = await this.decisionService.getCurrentDecision( DecisionStatus.SUGGEST_AND_VOTE_SUBJECT );

        if( ! decision )
        {
          throw new InternalServerErrorException("No active decision for submitting subjects");
        }
        logInfo( "Decision found: "+ decision._id );

        // Get 50 random users from DB
        let users = await this.userModel.aggregate([
          { $sample: { size: 50 } }
        ]);

        // Get the available subjects
        let subjects = await decision.submittedSubjects
        //logInfo( subjects );

        let votes = this.createRandomVoteDistribution( Math.min( 20, subjects.length ), 50 );

        for( let j in votes )
        {
          let user = users.pop();
          let subject_id = subjects[ votes[ j ] ]._id;

          let user_secret = crypto.randomUUID();
          let ballot = await this.votingSessionService.requestBallot( decision.subjectSelectionVotesession, user, user_secret );

          logInfo( "Got ballot: ", ballot );

          await this.votingSessionService.vote( user, ballot._id, user_secret,[subject_id.toString()] );
          

        }*/
    }

    ////////////////////////////////////////////////////:
    ///// Submit propositions
    else if (action == "submit_propositions") {
      // Find current compatible decision
      const decision = await this.decisionService.getCurrentDecision(DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL);

      if (!decision) {
        throw new InternalServerErrorException("No active decision for submitting propositions");
      }
      logInfo("Decision found: " + decision._id);

      const propositions = [
        "Maintenir le départ à 62 ans",
        "Revenir à une retraite à 60 ans",
        "Reculer le départ à 65 ans",
        "Reculer le départ à 64 ans",
        "Construire de nouvelles centrales et investir dans la recherche",
        "Planifier une sortie et fermer des centrales",
        "Diminuer la part dans le mix énergétique",
        "Exonérer la résidence principale de l'impôt sur la fortune immobilière",
        "Mettre en place un impôt sur la fortune climatique",
        "Renforcer l'imposition des très riches",
        "Conserver le système actuel",
        "Conserver la durée actuelle",
        "Réduire le temps de travail",
        "Libéraliser le temps de travail",
        "Revenir au septennat",
        "Décider de la durée du mandat par référendum",
        "Conserver le quinquennat",
        "Renforcer la répression",
        "Lancer un débat démocratique sur le sujet",
        "Favoriser les expulsions",
        "Durcir l'accès aux titres de séjour",
        "Interdire la chasse le week-end et les vacances scolaires",
        "Défendre cette pratique",
        "Interdire la chasse à courre",
        "Augmenter les salaires (smic, point d'indice…)",
        "Verser une prime",
        "Alléger impôts et cotisations",
        "Maintenir la loi actuelle",
        "Revenir à douze semaines",
        "Créer un référendum d'initiative citoyenne (RIC)",
        "Favoriser les outils existants",
        "Garder le barême actuel",
        "Réduire les impôts des couples",
        "Elargir le nombre de bénéficiaires",
        "Conditionner certains minima sociaux à une activité",
        "Supprimer des postes",
        "Créer massivement des postes",
        "Favoriser des recrutements sectoriels, en particulier dans la police et la justice",
        "Imposer un embargo strict",
        "Diminuer les achats d'hydrocarbures russes",
        "S'opposer à tout embargo",
        "Créer des dizaines de milliers de places",
        "Rénover les prisons et améliorer la condition des détenus",
        "Généraliser les alternatives à l'incarcération",
        "Favoriser la transmission d'entreprises",
        "Plafonner les successions à un certain montant",
        "Privilégier le droit national sur le droit européen",
        "Renforcer le rôle de l'UE (défense, diplomatie, politique)",
        "Se dégager des contraintes financières du pacte de stabilité",
        "Favoriser l'achat de voitures électriques ou moins polluantes",
        "Supprimer les contraintes sur les automobilistes",
        "Interdire à terme la vente des voitures thermiques neuves",
        "Diminuer le recours à la voiture",
        "Faciliter l'accès à la culture (gratuité, passe, etc.)",
        "Défendre les cultures régionales",
        "Augmenter le budget du ministère de la culture",
        "Faire porter un projet culturel à chaque école",
        "Augmenter le budget consacré au patrimoine",
        "Renforcer le contrôle aux frontières",
        "Dénoncer les accords restreignant le droit d'asile",
        "Permettre aux riverains de s'y opposer",
        "Stopper tous les projets en cours",
        "Prioriser les petites lignes",
        "Prioriser les trains du quotidien",
        "Renouveler tout le réseau",
        "Baisser les tarifs des billets ou favoriser la gratuité dans certains cas",
        "Réduire prioritairement les émissions du secteur industriel",
        "Décarboner la consommation des ménages",
        "Investir dans les énergies renouvelables",
        "Interdire les exportations de bois",
        "Investir dans le nucléaire",
        "Interdire les signes religieux dans tout l'espace public",
        "Interdire les signes religieux dans les services publics",
        "Limiter ou encadrer les financements étrangers",
        "Interdire les financements publics",
        "Favoriser les circuits courts",
        "Etiqueter l'origine des produits",
        "Interdire les additifs les plus controversés ",
        "Végétaliser l'alimentation",
        "Instaurer une allocation sous conditions (ressources, formation, accompagnement…)",
        "Exonérer d'impôt sur le revenu les jeunes actifs de moins de 30 ans",
        "Instaurer une allocation sans conditions"
      ];

      // Get 50 random users from DB
      const users = await this.userModel.aggregate([{ $sample: { size: 20 } }]);

      // Randomize propositions and get the 20 first
      propositions.sort(() => Math.random() - 0.5);

      for (let i = 0; i < 20; i++) {
        const proposition_label = propositions[i];
        const userId = users.pop()._id;
        logInfo("Inserting proposition: " + proposition_label + " by user " + userId);
        const proposition: CreateProposalDto = {
          title: proposition_label,
          decisionId: decision._id.toString()
        };
        await this.decisionService.submitProposition(proposition, user, userId.toString());
      }
    }

    ////////////////////////////////////////////////////:
    ///// Vote propositions
    else if (action == "vote_propositions") {
      // Find current compatible decision
      const decision = await this.decisionService.getCurrentDecision(DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL);

      if (!decision) {
        throw new InternalServerErrorException("No active decision for submitting propositions");
      }
      logInfo("Decision found: " + decision._id);

      // Get 50 random users from DB
      const users = await this.userModel.aggregate([{ $sample: { size: 50 } }]);

      // Get the available propositions
      const propositions = await decision.submittedPropositions;
      //logInfo( subjects );

      const votes = this.createRandomVoteDistribution(Math.min(20, propositions.length), 50);

      for (const j in votes) {
        const user = users.pop();
        const proposition_id = propositions[votes[j]]._id;

        const user_secret = crypto.randomUUID();
        const ballot = await this.votingSessionService.requestBallot(
          decision.propositionsSelectionVotesession,
          user,
          user_secret
        );

        logInfo("Got ballot: ", ballot);

        await this.votingSessionService.vote(user, ballot._id, user_secret, [proposition_id.toString()]);
      }
    }

    ////////////////////////////////////////////////////:
    ///// Vote general
    else if (action == "vote_general") {
      // Find current compatible decision
      const decision = await this.decisionService.getCurrentDecision(DecisionStatus.GENERAL_VOTE);

      if (!decision) {
        throw new InternalServerErrorException("No active decision for General Vote");
      }
      logInfo("Decision found: " + decision._id);

      // Get 50 random users from DB
      const users = await this.userModel.aggregate([{ $sample: { size: 50 } }]);

      // Get the available propositions
      const propositions = decision.propositions;
      //logInfo( subjects );

      const votes = this.createRandomVoteDistribution(propositions.length, 50);

      for (const j in votes) {
        const user = users.pop();
        const proposition_id = propositions[votes[j]]._id;

        const user_secret = crypto.randomUUID();

        if (decision.generalVoteVotesession == null) {
          throw new InternalServerErrorException("No general vote voting session found for decision: " + decision._id);
        }

        const ballot = await this.votingSessionService.requestBallot(
          decision.generalVoteVotesession,
          user,
          user_secret
        );

        logInfo("Got ballot: ", ballot);

        await this.votingSessionService.vote(user, ballot._id, user_secret, [proposition_id.toString()]);
      }
    }

    ////////////////////////////////////////////////////:
    ///// Vote session unit test
    else if (action == "votesession_create") {
      logInfo("Testing vote session (create)");

      const votingSessionId = await this.votingSessionService.createVotingSession(
        COUNTRY_TERRITORY_ID,
        DecisionStatus.GENERAL_VOTE,
        getCurrentDate().getTime(),
        getCurrentDate().getTime() + 24 * 3600 * 7 * 1000,
        1
      );
      await this.votingSessionService.addChoice(votingSessionId, "A");
      await this.votingSessionService.addChoice(votingSessionId, "B");
      await this.votingSessionService.addChoice(votingSessionId, "C");
      await this.votingSessionService.addChoice(votingSessionId, "D");
    } else if (action == "votesession_ballot_request") {
      logInfo("Request a ballot");

      if (!test_voting_session) {
        throw new BadRequestException("test_voting_session parameter is required for this action");
      }

      const vote_session_id = test_voting_session;

      // Generate a secret
      const voter_secret = "jgezAEJ64FZ74TY63454dc3";

      await this.votingSessionService.requestBallot(vote_session_id, user, voter_secret);
    } else if (action == "votesession_vote") {
      logInfo("Vote");

      const voter_secret = "jgezAEJ64FZ74TY63454dc3";
      const ballot_id = "66a50cb06a0ce85d7fa66b18";
      const choices = ["to infinity", "and beyond"];

      await this.votingSessionService.vote(user, ballot_id, voter_secret, choices);
    } else if (action == "votesession_mass_vote") {
      logInfo("Mass Vote");

      if (!test_voting_session) {
        throw new BadRequestException("test_voting_session parameter is required for this action");
      }

      const nbr_voters = 1;
      const vote_session_id = test_voting_session;

      // Get voting session infos
      const votingSession = await this.votingSessionService.getVotingSession(vote_session_id);
      if (!votingSession) {
        throw new InternalServerErrorException("Voting session not found: " + vote_session_id);
      }

      // Get possible choices
      const choice_nbr = votingSession.votingSession.choices.length;
      if (choice_nbr == 0) {
        throw new InternalServerErrorException("No choice found for voting session: " + vote_session_id);
      }

      // Select N random voters and generate secrets for them

      const users = await this.userModel.aggregate([{ $sample: { size: nbr_voters } }]);

      for (const i in users) {
        logInfo("Make user " + users[i].email + " vote (" + i + ")");

        // Create a secret for this user
        const user_secret = crypto.randomUUID();

        // Request a ballot
        const ballot: BallotDto = await this.votingSessionService.requestBallot(vote_session_id, users[i], user_secret);

        const choices: string[] = [];

        let choice_count = 1;
        if (votingSession.votingSession.maxChoices != null && votingSession.votingSession.maxChoices > 1) {
          // Get a random choice between 1 and choice_nbr-1 to have the number of choices to vote for
          choice_count = Math.floor(Math.random() * (choice_nbr - 1)) + 1;
        }

        logInfo("User will vote for " + choice_count + " choices");

        // Now, select choices_count different choices (or at least a maximum of choice_nbr)
        const choice_indexes: number[] = [];
        while (choice_indexes.length < choice_count) {
          const choice_index = Math.floor(Math.random() * choice_nbr);
          if (!choice_indexes.includes(choice_index)) {
            choice_indexes.push(choice_index);
            // Add this choice to the choices list
            choices.push(votingSession.votingSession.choices[choice_index]);
          }
        }

        await this.votingSessionService.vote(users[i], ballot._id, user_secret, choices);
      }
    } else if (action == "votesession_close") {
      logInfo("Closing vote session");
      if (!test_voting_session) {
        throw new BadRequestException("test_voting_session parameter is required for this action");
      }
      const vote_session_id = test_voting_session;
      await this.votingSessionService.closeVotingSession(vote_session_id);
    } else if (action == "votesession_reset") {
      logInfo("Reset vote session");

      if (!test_voting_session) {
        throw new BadRequestException("test_voting_session parameter is required for this action");
      }
      const vote_session_id = test_voting_session;

      await this.votingSessionService.resetVote(vote_session_id);
    } else if (action == "votesession_display") {
      logInfo("Display vote session");

      if (!test_voting_session) {
        throw new BadRequestException("test_voting_session parameter is required for this action");
      }
      const vote_session_id = test_voting_session;
      return await this.votingSessionService.getVotingSession(vote_session_id);
    } else if (action == "votesession_audit") {
      logInfo("Audit vote session");

      if (!test_voting_session) {
        throw new BadRequestException("test_voting_session parameter is required for this action");
      }
      const vote_session_id = test_voting_session;
      return await this.votingSessionService.getVotingSessionAuditableData(vote_session_id, user);
    }
    return true;
  }

  createRandomVoteDistribution(choice_nbr: number, votesNbr: number): number[] {
    logInfo("Creating a random vote distribution with " + choice_nbr + " and " + votesNbr + " votes");

    const votes: number[] = []; // List of votes
    const choice_to_vote = {}; // Choice to number of votes

    // Init choice_to_vote
    for (let i = 0; i < choice_nbr; i++) {
      choice_to_vote[i] = 0;
    }

    // Determine votes
    for (let i = 0; i < votesNbr; i++) {
      // Each choice have a probability of 1 + number of votes for this choice

      // Get a random number between 0 and ( count of all previous votes + 1 per choice )
      const max_target = choice_nbr + i - 1;
      const target = Math.floor(Math.random() * (max_target + 1));

      // logInfo("vote "+i+", random target = "+target+" (max: "+max_target+")");
      // Get the corresponding vote
      let counter = 0;
      let choice = 0;
      while (counter + 1 + choice_to_vote[choice] <= target) {
        // logInfo("counter = "+counter+", choice = "+choice);
        if (choice_to_vote[choice] != null) {
          counter = counter + 1 + choice_to_vote[choice];
          choice++;
        } else {
          throw new InternalServerErrorException("Cannot reach target " + target + " in createRandomVoteDistribution");
        }
      }

      // choice = our choice for this vote
      // logInfo("=> vote "+i+", choice = "+choice);
      votes.push(choice);
      choice_to_vote[choice]++;
    }

    logInfo(choice_to_vote);

    return votes;
  }
}
