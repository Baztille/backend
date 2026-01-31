import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { DebateArgumentService } from "./debate-argument.service";
import { DebateContextService } from "./debate-context.service";
import { DebateSummaryDto } from "./dto/debate-summary.dto";
import { SubjectContextSummaryDto } from "./dto/subject-context.dto";

@Injectable()
export class DebateService {
  constructor(
    private readonly httpService: HttpService,
    private readonly debateContextService: DebateContextService,
    private readonly debateArgumentService: DebateArgumentService
  ) {}

  /**
   * Get debate summary:
   * - Best context explaining the subject
   * - 3 best arguments for and against each proposition (titles only)
   * @param decisionId
   * @returns debate summary
   */
  async getDebateSummary(decisionId: string): Promise<DebateSummaryDto> {
    const subjectContext: SubjectContextSummaryDto = await this.debateContextService.getDebateContextFromDecision(
      decisionId
    );
    const argumentsSummary = await this.debateArgumentService.getDebateArgumentsSummary(decisionId);

    return {
      subjectContext: subjectContext,
      arguments: argumentsSummary
    };
  }
}
