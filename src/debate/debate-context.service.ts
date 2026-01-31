import { HttpService } from "@nestjs/axios";
import { ForbiddenException, Injectable } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";
import { InjectModel } from "@nestjs/mongoose";
import mongoose, { Model } from "mongoose";
import { InternalEventsEnum } from "src/common/enum/internal-events.enum";
import { getCurrentDate } from "src/utils/date-time";
import { logError, logInfo } from "src/utils/logger";
import { AiService } from "../ai/ai.service";
import { User } from "../profile/user/types/user.type";
import { DecisionService } from "../vote/decision/decision.service";
import { ContextPropositionMongo, DebateContextDocument, DebateContextMongo } from "./debate.schema";
import { ContextPropositionsSortedListDto, ContextPropositionWithUserVoteDto } from "./dto/context-proposition.dto";
import { SubjectContextSummaryDto } from "./dto/subject-context.dto";

@Injectable()
export class DebateContextService {
  constructor(
    private readonly httpService: HttpService,
    @InjectModel(DebateContextMongo.name) private readonly debateContextModel: Model<DebateContextMongo>,
    private readonly decisionService: DecisionService,
    private readonly aiService: AiService
  ) {}

  private ai_user: User = { _id: "000000000000000000000000", email: "ai@baztille.org" } as User; // Fake user ID for AI generated content

  /**
   * Initialize a new debate context the given decision
   * Note: only one debate context can be initialized for a given decision
   * @param decisionId
   * @returns new debate context id
   */
  @OnEvent(InternalEventsEnum.DEBATE_INITIALIZE_CONTEXT, { async: true })
  async initDebateContext(payload: { decisionId: string }) {
    const decisionId = payload.decisionId;

    logInfo("Initialize a new debate context for decision " + decisionId);

    // Get decision
    const decision = await this.decisionService.getDecision(decisionId);

    // Check if a debate context already exists for this decision
    const existingDebateContext = await this.debateContextModel.findOne({ decision: decisionId });
    if (existingDebateContext) {
      throw new ForbiddenException("A debate context already exists for this decision");
    }

    // Create new debate context
    logInfo("Creating new debate context for decision " + decisionId);
    const newDebateContext = new this.debateContextModel({
      decision: decisionId,
      debateEndDate: decision.decisionDate,
      text: ""
    });
    const newDebateContextCreated = await newDebateContext.save();

    // Fill debate context using AI generated content (so it is not empty)
    this.fillDebateContextUsingAI(decisionId);

    return newDebateContextCreated._id;
  }

  /**
   * Get the basic informations about current subject context, from Decision ID
   * @param decisionId
   * @returns DebateContext
   */
  async getDebateContextFromDecision(decisionId: string): Promise<SubjectContextSummaryDto> {
    const debateContext = await this.debateContextModel.findOne({ decision: decisionId }, { text: 1 });

    if (debateContext === null) {
      throw new ForbiddenException("getDebateContext: No debate context found for this decision id: " + decisionId);
    }

    return debateContext;
  }

  /**
   * Get the basic informations about current subject context, from Decision Context ID
   * @param decisionContextId
   * @returns DebateContext
   */
  async getDebateContext(decisionContextId: string): Promise<DebateContextDocument> {
    const debateContext = await this.debateContextModel.findOne({ _id: decisionContextId }, { text: 1 });

    if (debateContext === null) {
      throw new ForbiddenException(
        "getDebateContext: No debate context found for this decision context id: " + decisionContextId
      );
    }

    return debateContext;
  }

  /**
   * Get the complete infos about current subject context
   * @param decisionContextId
   * @returns DebateContext
   */
  async getDebateContextList(decisionContextId: string, user: User): Promise<ContextPropositionsSortedListDto> {
    // Get the debate context with id decisionContextId with (if it exists) the vote of the current user

    const filter: mongoose.ProjectionType<DebateContextDocument> = {
      text: 1,
      textId: 1,

      // From submittedContext array, display only text and votesCount fields
      ["submittedContext.text"]: 1,
      ["submittedContext.votesCount"]: 1,
      ["submittedContext._id"]: 1,

      // Display the vote of the current user
      ["votes." + user._id]: 1
    };

    const debateContext: DebateContextDocument | null = await this.debateContextModel.findOne(
      { _id: decisionContextId },
      filter
    );

    //console.log( debateContext );

    if (debateContext === null) {
      throw new ForbiddenException(
        "getDebateContextList: No debate context found for this decision: " + decisionContextId
      );
    }

    const currentVote: string | undefined = debateContext.votes.get(user._id);

    // Build final result
    const result: ContextPropositionsSortedListDto = {
      sorted: [],
      all: {}
    };

    //console.log( debateContext );
    //console.log( debateContext.submittedContext );

    // Sort submitted context propositions by votes count
    const sortedSubmittedContext: ContextPropositionMongo[] = debateContext.submittedContext.sort(
      (a, b) => b.votesCount - a.votesCount
    );

    for (const i in sortedSubmittedContext) {
      const returnedContext: ContextPropositionWithUserVoteDto = {
        text: sortedSubmittedContext[i].text,
        votesCount: sortedSubmittedContext[i].votesCount,
        _id: sortedSubmittedContext[i]._id,
        userVoted: currentVote == sortedSubmittedContext[i]._id
      };

      result.all[sortedSubmittedContext[i]._id] = returnedContext;
      result.sorted.push(sortedSubmittedContext[i]._id);
    }

    return result;
  }

  /**
   * Add a new context proposition for a decision
   * @param decisionContextId
   * @param text
   * @returns new context proposition id
   */
  async addContextProposition(decisionContextId: string, text: string, author: User): Promise<string> {
    const debateContext = await this.getDebateContext(decisionContextId);

    if (getCurrentDate().getTime() > debateContext.debateEndDate) {
      throw new ForbiddenException("Cannot add a new context proposition after the debate end date");
    }

    // Check that the text is less than 1200 characters
    if (text.length > 1200) {
      // Do not throw exception: just truncate the text (reason = AI may generate long texts)
      //throw new ForbiddenException("Context proposition text is too long");
      text = text.substring(0, 1200 - 3) + "...";
    }

    // Create new context proposition
    const contextPropositionId = new mongoose.Types.ObjectId();
    const contextProposition: ContextPropositionMongo = {
      _id: contextPropositionId.toString(),
      text: text,
      author: author._id,
      votesCount: 0,
      versions: [
        {
          text: text,
          author: author._id,
          creationDate: getCurrentDate().getTime()
        }
      ]
    };

    logInfo(contextProposition);

    await this.debateContextModel.findOneAndUpdate(
      { _id: decisionContextId },
      {
        $push: {
          submittedContext: contextProposition
        }
      }
    );

    this.updateMostVotedContextProposition(decisionContextId);

    return contextPropositionId.toString();
  }

  /**
   * Vote for a context proposition
   * Note: there is only "upvote" for context propositions
   * @param decisionContextId
   * @param context_proposition_id
   * @returns true
   */
  async voteContextProposition(
    decisionContextId: string,
    context_proposition_id: string,
    user: User
  ): Promise<ContextPropositionsSortedListDto> {
    // Check if context proposition exists
    const debateContext = await this.debateContextModel.findOne({ _id: decisionContextId });
    if (debateContext === null) {
      throw new ForbiddenException(
        "updateMostVotedContextProposition: No debate context found for this decision context id: " + decisionContextId
      );
    }

    // Check if context proposition exists
    const contextProposition = debateContext.submittedContext.find(
      (contextProposition) => contextProposition._id.toString() === context_proposition_id
    );
    if (contextProposition === undefined) {
      throw new ForbiddenException("Context proposition not found: " + context_proposition_id);
    }

    // Check if user already voted for this context proposition
    const currentVote = debateContext.votes.get(user._id);
    if (currentVote) {
      // User already voted for this context proposition

      // Decrement current vote count
      await this.debateContextModel.findOneAndUpdate(
        { _id: decisionContextId, "submittedContext._id": currentVote },
        {
          $inc: {
            "submittedContext.$.votesCount": -1
          }
        }
      );
    }

    if (currentVote == context_proposition_id) {
      // User just wanted to cancel his vote
      await this.debateContextModel.findOneAndUpdate(
        { _id: decisionContextId },
        {
          $unset: {
            ["votes." + user._id]: ""
          }
        }
      );
    } else {
      // Record vote
      const field_name = "votes." + user._id;
      const updateData = {
        $set: {
          [field_name]: context_proposition_id
        }
      };
      await this.debateContextModel.findOneAndUpdate({ _id: decisionContextId }, updateData);

      // Increment votes count
      await this.debateContextModel.findOneAndUpdate(
        { _id: decisionContextId, "submittedContext._id": context_proposition_id },
        {
          $inc: {
            "submittedContext.$.votesCount": 1
          }
        }
      );
    }

    this.updateMostVotedContextProposition(decisionContextId);

    // Return the whole debate context list to update the UI
    return await this.getDebateContextList(decisionContextId, user);
  }

  /**
   * Select the context proposition with the most votes
   * @param decisionContextId
   * @returns true
   */
  async updateMostVotedContextProposition(decisionContextId: string): Promise<boolean> {
    // Check if context proposition exists
    const debateContext = await this.debateContextModel.findOne({ _id: decisionContextId });
    if (debateContext === null) {
      throw new ForbiddenException(
        "updateMostVotedContextProposition: No debate context found for this decision context id: " + decisionContextId
      );
    }

    // Get the context proposition with the most votes
    const mostVotedContextProposition = debateContext.submittedContext.reduce((prev, current) =>
      prev.votesCount > current.votesCount ? prev : current
    );

    // Update debate context
    await this.debateContextModel.findOneAndUpdate(
      { _id: decisionContextId },
      {
        $set: {
          text: mostVotedContextProposition.text,
          textId: mostVotedContextProposition._id
        }
      }
    );

    return true;
  }

  /**
   * Fill debate context for given decision using AI generated content
   * @param decisionId decision Id to fill debate context for
   * @returns void
   */
  async fillDebateContextUsingAI(decisionId: string): Promise<void> {
    logInfo("Fill subject context in order to avoid having an empty debate");

    // Get decision
    const decision = await this.decisionService.getDecision(decisionId);

    // Check if a debate context already exists for this decision
    const existingDebateContext = await this.debateContextModel.findOne({ decision: decisionId });
    if (!existingDebateContext) {
      logError("fillDebateContextUsingAI: no debate context exists for decision: " + decisionId);
      return;
    }

    const context_text = await this.aiService.getSubjectContext(decision.subject, decision.territory);
    await this.addContextProposition(existingDebateContext._id, context_text, this.ai_user);

    // Example: vote for a proposition
    // await this.voteContextProposition( existingDebateContext._id, context_proposition_id, this.ai_user );
  }
}
