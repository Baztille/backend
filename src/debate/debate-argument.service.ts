import { HttpService } from "@nestjs/axios";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model } from "mongoose";
import { InternalEventsEnum } from "src/common/enum/internal-events.enum";
import { TrackEventType } from "src/event/event-types";
import { getCurrentDate } from "src/utils/date-time";
import { logInfo } from "src/utils/logger";
import { AiService } from "../ai/ai.service";
import { EventService } from "../event/event.service";
import { User } from "../profile/user/types/user.type";
import { DecisionService } from "../vote/decision/decision.service";
import { DecisionStatus } from "../vote/decision/types/decision-status.enum";
import { ArgumentType, DebateArgumentMongo } from "./debate.schema";
import { ArgumentDebateSummaryDto } from "./dto/argument-debate-summary.dto";
import { DebateArgumentDto, DebateArgumentListDto } from "./dto/argument-debate.dto";

@Injectable()
export class DebateArgumentService {
  constructor(
    private readonly httpService: HttpService,
    @InjectModel(DebateArgumentMongo.name) private readonly debateArgumentModel: Model<DebateArgumentMongo>,
    private readonly decisionService: DecisionService,
    private readonly aiService: AiService,
    private readonly eventService: EventService
  ) {}

  private ai_user: User = { _id: "000000000000000000000000", email: "ai@baztille.org" } as User; // Fake user ID for AI generated content

  /**
   * Get all arguments for a decision
   * @param decisionId
   * @returns DebateContext
   */
  async getDebateArguments(user: User, decisionId: string, proposition_id?: string): Promise<DebateArgumentListDto> {
    const filter = proposition_id
      ? {
          decision: new mongoose.Types.ObjectId(decisionId),
          proposition: new mongoose.Types.ObjectId(proposition_id)
        }
      : { decision: new mongoose.Types.ObjectId(decisionId) };

    // Get all "for" arguments for this decision, sorted by votes count (decreasing)
    const allForArgs = await this.debateArgumentModel.aggregate([
      {
        $match: {
          ...filter,
          type: ArgumentType.FOR
        }
      },
      {
        $addFields: {
          userVoted: "$votes." + user._id
        }
      },
      {
        $project: { text: 1, title: 1, parent: 1, proposition: 1, type: 1, reactions: 1, votesCount: 1, userVoted: 1 }
      },
      {
        $sort: {
          votesCount: -1
        }
      }
    ]);

    // Get all "against" arguments for this decision, sorted by votes count (decreasing)
    const allAgainstArgs = await this.debateArgumentModel.aggregate([
      {
        $match: {
          ...filter,
          type: ArgumentType.AGAINST
        }
      },
      {
        $addFields: {
          userVoted: "$votes." + user._id
        }
      },
      {
        $project: { text: 1, title: 1, parent: 1, proposition: 1, type: 1, reactions: 1, votesCount: 1, userVoted: 1 }
      },
      {
        $sort: {
          votesCount: -1
        }
      }
    ]);

    //// Now, build the final target structure we need

    const result: DebateArgumentListDto = {
      all: {}, // All arguments, ID => data
      for: [], // Sorted IDs of FOR arguments (by descending vote count),
      against: [] // Sorted IDs of AGAINST arguments (by descending vote count),
    };

    for (const i in allForArgs) {
      result.all[allForArgs[i]._id] = allForArgs[i];
      result.for.push(allForArgs[i]._id);
    }
    for (const i in allAgainstArgs) {
      result.all[allAgainstArgs[i]._id] = allAgainstArgs[i];
      result.against.push(allAgainstArgs[i]._id);
    }

    return result;
  }

  async getDebateArgument(user: User, argument_id: string): Promise<DebateArgumentDto> {
    const argument = await this.debateArgumentModel.aggregate<DebateArgumentDto>([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(argument_id)
        }
      },
      {
        $addFields: {
          userVoted: "$votes." + user._id
        }
      },
      {
        $project: { text: 1, title: 1, parent: 1, proposition: 1, type: 1, reactions: 1, votesCount: 1, userVoted: 1 }
      }
    ]);

    return argument[0];
  }

  /**
   * Get a summary of top arguments for a decision
   *
   * @param decisionId
   * @returns arguments summary
   */
  async getDebateArgumentsSummary(decisionId: string): Promise<ArgumentDebateSummaryDto[]> {
    // We will return the 3 best arguments for and against each proposition
    // We will return only the title of the arguments and their type (for or against)

    logInfo("Getting top argument summary for decision: " + decisionId);

    // Get all arguments for this decision

    const result = await this.debateArgumentModel.aggregate<ArgumentDebateSummaryDto>([
      {
        // Match arguments for this decision which are not sub-arguments
        $match: {
          decision: new mongoose.Types.ObjectId(decisionId),
          parent: {
            $exists: false
          }
        }
      },
      {
        // Keep only the fields we need
        $project: {
          title: 1,
          votesCount: 1,
          type: 1,
          proposition: 1
        }
      },
      {
        // Sort by votes count (decreasing)
        $sort: {
          votesCount: -1
        }
      },
      {
        // Group by proposition and argument type (for and against)
        $group: {
          _id: {
            proposition: "$proposition",
            type: "$type"
          },
          top_arguments: {
            $push: "$$ROOT"
          }
        }
      },
      {
        // Keep only the top 3 arguments for each proposition and type
        $project: {
          top_arguments: {
            $slice: ["$top_arguments", 3]
          }
        }
      }
    ]);

    //result = await this.debateArgumentModel.find( {decision: decisionId} );

    logInfo(result);

    return result;
  }

  /**
   * Add a new argument to a decision
   * @param decisionId
   * @param proposition
   * @param parent
   * @param title
   * @param text
   * @returns new argument id
   */
  async addArgument(
    decisionId: string,
    proposition: string,
    parent: string | null | undefined,
    title: string,
    text: string,
    type: ArgumentType,
    author: User
  ): Promise<string> {
    // Check that the decision exists and is on the right status
    const decision = await this.decisionService.getDecision(decisionId, true);

    if (
      decision.status !== DecisionStatus.GENERAL_VOTE &&
      decision.status !== DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL
    ) {
      throw new ForbiddenException(
        "Cannot add an argument for a decision that is not in general vote status or suggest/vote proposal"
      );
    }

    // Check that the proposition exists for this decision (if in general vote status)
    logInfo("Checking proposition: " + proposition + " for decision: " + decisionId + " with parent: " + parent);
    if (
      decision.status == DecisionStatus.GENERAL_VOTE &&
      decision.propositions.find((prop) => prop._id.toString() == proposition) === undefined
    ) {
      throw new ForbiddenException("Proposition ID not found for this decision: " + proposition);
    }

    // Check that the proposition exists for this decision (if in suggest/vote proposal status)
    if (
      decision.status == DecisionStatus.SUGGEST_AND_VOTE_PROPOSAL &&
      decision.submittedPropositions.find((prop) => prop._id.toString() == proposition) === undefined
    ) {
      throw new ForbiddenException("Submitted proposition ID not found for this decision: " + proposition);
    }

    // If there is a parent, check that the parent argument exists for this decision and this proposition
    let parentArgument = null;
    if (parent !== null && parent !== "" && parent !== undefined) {
      parentArgument = await this.debateArgumentModel.findOne({
        _id: parent,
        decision: decisionId,
        proposition: proposition
      });

      if (!parentArgument) {
        throw new ForbiddenException("Parent argument ID not found for this decision (and proposition)");
      }
    }

    // Check that the text is less than 500 characters
    if (text.length > 500) {
      // Do not throw exception: just truncate the text (reason = AI may generate long texts)
      // throw new ForbiddenException("Argument text is too long (max 500 characters)");
      text = text.substring(0, 500 - 3) + "...";
    }

    // Check that the title has less than 40 characters
    if (title.length > 40) {
      // Do not throw exception: just truncate the title (reason = AI may generate long titles)
      // throw new ForbiddenException("Argument title is too long (max 40 characters)");
      title = title.substring(0, 40 - 3) + "...";
    }

    // Create new argument
    const argumentId = new mongoose.Types.ObjectId();
    const argument = new this.debateArgumentModel({
      _id: argumentId.toString(),
      text: text,
      title: title,
      type: type,
      parent: parent ? parent : undefined,
      proposition: proposition,
      decision: decisionId,
      author: author._id,
      votesCount: 0,
      versions: [
        {
          text: text,
          author: author._id,
          creationDate: getCurrentDate().getTime()
        }
      ]
    });

    const newArgument = await argument.save();

    if (parentArgument) {
      // Increment add new argument reference to parent argument
      await this.debateArgumentModel.findOneAndUpdate(
        { _id: parent },
        {
          $push: {
            reactions: newArgument._id
          }
        }
      );
    }

    return newArgument._id;
  }

  /**
   * Vote for an argument (upvote or downvote)
   * @param argument_id
   * @param vote (1 for upvote, -1 for downvote)
   * @returns new debate argument
   */
  async voteArgument(argument_id: string, vote: number, user: User): Promise<DebateArgumentDto> {
    // Check that vote is valid
    if (vote !== 1 && vote !== -1) {
      throw new ForbiddenException("Invalid vote value");
    }

    // Check if argument exists
    const argument = await this.debateArgumentModel.findOne({ _id: argument_id });

    if (argument === null) {
      throw new ForbiddenException("Argument not found");
    }

    // Get current user vote
    const userVote = argument.votes.get(user._id);

    let voteCountIncrement = 1;
    let bRemoveVote = false;

    if (userVote !== undefined && userVote !== null) {
      // User already voted for this argument

      if (userVote == vote) {
        // User already voted for this argument with the same vote
        // => cancel this vote
        voteCountIncrement = -1;

        // Remove vote
        bRemoveVote = true;
      } else {
        // User already voted for this argument with a different vote

        voteCountIncrement = 2; // increment by 2 because we are changing the vote
      }
    } else {
      // User did not vote for this argument
    }

    // Record vote
    const field_name = "votes." + user._id;
    let updateData;
    if (bRemoveVote) {
      updateData = {
        $unset: {
          [field_name]: ""
        }
      };
    } else {
      updateData = {
        $set: {
          [field_name]: vote
        }
      };
    }

    updateData["$inc"] = {
      votesCount: vote * voteCountIncrement
    };

    await this.debateArgumentModel.findOneAndUpdate({ _id: argument_id }, updateData);

    // Track event
    await this.eventService.trackEvent(TrackEventType.ARGUMENT_VOTED);

    return await this.getDebateArgument(user, argument_id);
  }

  /**
   * Generate debate arguments (3 for / 3 against) for a given proposition + decision, using AI
   * @returns void
   */
  @OnEvent(InternalEventsEnum.AI_GENERATE_PROPOSITION_ARGUMENTS)
  async fillDebateArgumentsUsingAI(payload: { propositionId: string; decisionId: string }) {
    // Get decision
    const decision = await this.decisionService.getDecision(payload.decisionId);

    if (decision === null) {
      logInfo("fillDebateArgumentsUsingAI: Decision not found: " + payload.decisionId);
      return;
    }

    const subject = decision.subject;

    // Get the proposition text from its id
    // Note: it could be either in "submittedPropositions" or in "propositions" depending on the decision status

    let propositionText = "";

    const propositionInSubmitted = decision.submittedPropositions.find(
      (prop) => prop._id.toString() == payload.propositionId
    );
    if (propositionInSubmitted) {
      propositionText = propositionInSubmitted.text;
    } else {
      const propositionInPropositions = decision.propositions.find(
        (prop) => prop._id.toString() == payload.propositionId
      );
      if (propositionInPropositions) {
        propositionText = propositionInPropositions.text;
      }
    }

    if (propositionText === "") {
      logInfo(
        "fillDebateArgumentsUsingAI: Proposition not found in decision: " +
          payload.decisionId +
          " propositionId: " +
          payload.propositionId
      );
      return;
    }

    logInfo("Proposition text: " + propositionText);

    const argumentsList = await this.aiService.generateArguments(subject, propositionText, decision.territory);

    logInfo("Generated arguments: ", argumentsList);

    for (const argument of argumentsList) {
      logInfo("Adding argument: ", argument);
      await this.addArgument(
        decision._id,
        payload.propositionId,
        null,
        argument.title,
        argument.text,
        argument.type,
        this.ai_user
      );
    }

    logInfo("All arguments added for proposition: " + payload.propositionId);
  }
}
