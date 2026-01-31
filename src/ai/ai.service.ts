import { HttpService } from "@nestjs/axios";
import { Injectable } from "@nestjs/common";
import { readFile } from "fs/promises";
import * as path from "path";
import { logError, logInfo } from "src/utils/logger";

import OpenAI from "openai";
import { TerritorySummaryDto } from "src/countrymodel/dto/territory.dto";
import { ArgumentType } from "src/debate/debate.schema";

@Injectable()
export class AiService {
  private promptCache = new Map<string, string>();
  constructor(private readonly httpService: HttpService) {}

  /**
   * Load a prompt from cache or from ./src/ai/prompts/<lang>/<promptName>.md
   * Caches results in memory.
   * @param promptName example: get_debate_arguments
   */
  private async loadAiPrompt(promptName: string): Promise<string> {
    const lang = process.env.AI_PROMPT_LANGUAGE ?? "fr";

    const fullPath = path.resolve(__dirname, "../../ai/prompts", lang, promptName + ".md");

    const cacheKey = `${lang}:${promptName}`;
    const cached = this.promptCache.get(cacheKey);
    if (cached) return cached;

    try {
      const content = await readFile(fullPath, { encoding: "utf8" });
      this.promptCache.set(cacheKey, content);
      return content;
    } catch (err) {
      logError("Error loading prompt file", err);
      throw new Error(`Cannot load prompt file ${fullPath}: ${err?.message}`);
    }
  }

  /**
   * Add 4 new valid subjects for Baztille using AI
   * @returns array of subjects (and associated themes)
   */
  // DEPRECATED as unseful with the new syste
  /*
  async getSubjects(): Promise<any> {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

      if (process.env.GPT_PROMPT_GET_SUBJECTS_INSTRUCTIONS == undefined) {
        throw new Error("GPT_PROMPT_GET_SUBJECTS_INSTRUCTIONS is not defined");
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: process.env.GPT_PROMPT_GET_SUBJECTS_INSTRUCTIONS }],
        response_format: { type: "json_object" }
      });

      logInfo("OpenAI API raw answer: ", completion);

      if (completion?.choices[0]?.message?.content) {
        const result_json = completion?.choices[0]?.message?.content;
        logInfo("raw JSON response: ", result_json);
        logInfo(typeof result_json);
        try {
          const subjects = JSON.parse(result_json);

          logInfo("Parsed answer: ", subjects);
          return subjects?.subjects;
        } catch (error) {
          logError("Error during OpenAI API response JSON parsing");
        }
      } else {
        throw Error("Invalid OpenAI API answer");
      }
    } catch (error) {
      logError(error);
      throw new Error(`Erreur OpenAI : ${error.message}`);
    }
  }*/

  /**
   * Add 4 new valid propositions for Baztille using AI (for given subject)
   * @returns array of propositions
   */
  // DEPRECATED as unseful with the new system
  /*
  async getPropositions(subject_text: string): Promise<any> {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

      if (process.env.GPT_PROMPT_GET_PROPOSITIONS_INSTRUCTIONS == undefined) {
        throw new Error("GPT_PROMPT_GET_PROPOSITIONS_INSTRUCTIONS is not defined");
      }

      const prompt = process.env.GPT_PROMPT_GET_PROPOSITIONS_INSTRUCTIONS.replace("$current_subject$", subject_text);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      logInfo("OpenAI API raw answer: ", completion);

      if (completion?.choices[0]?.message?.content) {
        const result_json = completion?.choices[0]?.message?.content;
        logInfo("raw JSON response: ", result_json);
        logInfo(typeof result_json);
        try {
          const propositions = JSON.parse(result_json);

          logInfo("Parsed answer: ", propositions);
          return propositions?.propositions;
        } catch (error) {
          logError("Error during OpenAI API response JSON parsing");
        }
      } else {
        throw Error("Invalid OpenAI API answer");
      }
    } catch (error) {
      logError(error);
      throw new Error(`Erreur OpenAI : ${error.message}`);
    }
  }*/

  /**
   * Get the context of a subject using AI
   * @returns string (context)
   */
  async getSubjectContext(subjectText: string, territory: TerritorySummaryDto): Promise<string> {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

      const promptTemplate = await this.loadAiPrompt("get_subject_context");

      const prompt = promptTemplate
        .replace("{{current_subject}}", subjectText)
        .replace("{{territory_name}}", territory.name)
        .replace("{{territory_type}}", territory.type.name);

      logInfo("Prompt: ", prompt);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }]
      });

      logInfo("OpenAI API raw answer: ", completion);

      if (completion?.choices[0]?.message?.content) {
        return completion?.choices[0]?.message?.content;
      } else {
        throw Error("Invalid OpenAI API answer");
      }
    } catch (error) {
      logError(error);
      throw new Error(`Erreur OpenAI : ${error.message}`);
    }
  }

  /**
   * Get the arguments for and against a proposition using AI
   * @returns array of arguments
   */
  async generateArguments(
    subject: string,
    propositionText: string,
    territory: TerritorySummaryDto
  ): Promise<{ title: string; text: string; type: ArgumentType }[]> {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

      const promptTemplate = await this.loadAiPrompt("get_debate_arguments");

      const prompt = promptTemplate
        .replace("{{current_subject}}", subject)
        .replace("{{proposition_text}}", propositionText)
        .replace("{{territory_name}}", territory.name)
        .replace("{{territory_type}}", territory.type.name);

      logInfo("Prompt: ", prompt);

      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" }
      });

      logInfo("OpenAI API raw answer: ", completion);

      if (completion?.choices[0]?.message?.content) {
        const result_json = completion?.choices[0]?.message?.content;
        logInfo("raw JSON response: ", result_json);
        logInfo(typeof result_json);
        try {
          const argumentsList = JSON.parse(result_json);

          logInfo("Parsed answer: ", argumentsList);
          return argumentsList?.arguments;
        } catch (error) {
          logError("Error during OpenAI API response JSON parsing");
        }
      } else {
        throw Error("Invalid OpenAI API answer");
      }
    } catch (error) {
      logError(error);
      throw new Error(`Erreur OpenAI : ${error.message}`);
    }

    return [];
  }
}
