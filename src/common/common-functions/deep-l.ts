import * as deepl from "deepl-node";

export type CommonLanguageCode =
  | "ar"
  | "bg"
  | "cs"
  | "da"
  | "de"
  | "el"
  | "es"
  | "et"
  | "fi"
  | "fr"
  | "hu"
  | "id"
  | "it"
  | "ja"
  | "ko"
  | "lt"
  | "lv"
  | "nb"
  | "nl"
  | "pl"
  | "ro"
  | "ru"
  | "sk"
  | "sl"
  | "sv"
  | "tr"
  | "uk"
  | "zh";

/**
 * The function `translateText` translates text from a source language to a target language using the
 * DeepL API.
 * @param {string} text - The `text` parameter is a string that represents the text you want to
 * translate.
 * @param targetLang - The `targetLang` parameter in the `translateText` function represents the target
 * language code to which the input text should be translated. It is of type
 * `deepl.TargetLanguageCode`. This code specifies the language into which the text will be translated.
 * @param [sourceLang] - The `sourceLang` parameter in the `translateText` function is an optional
 * parameter that represents the source language of the text you want to translate. If you provide a
 * value for `sourceLang`, the text will be translated from that specific language to the `targetLang`.
 * If you do not provide
 * @returns The `translateText` function returns the translated text in the target language specified.
 */
export async function translateText(
  text: string,
  targetLang: deepl.TargetLanguageCode,
  sourceLang?: deepl.SourceLanguageCode
) {
  if (!process.env.DEEPL_AUTH_KEY) {
    throw new Error("DEEPL_AUTH_KEY is not defined");
  }

  const translator = new deepl.Translator(process.env.DEEPL_AUTH_KEY);
  const result = await translator.translateText(text, sourceLang || null, targetLang);
  return result.text;
}

/**
 * This TypeScript function translates multiple text items using the DeepL API asynchronously.
 * @param {string[]} textList - An array of strings containing the text that needs to be translated.
 * @param targetLang - The `targetLang` parameter in the `translateMultipleText` function refers to the
 * target language code to which the text in the `textList` should be translated. It is a required
 * parameter that specifies the language into which the text should be translated.
 * @param [sourceLang] - The `sourceLang` parameter in the `translateMultipleText` function is an
 * optional parameter that specifies the source language of the text to be translated. If this
 * parameter is not provided, the translation will be done from the detected source language.
 * @returns The function `translateMultipleText` returns a Promise that resolves to an array of
 * `deepl.TextResult` objects.
 */
export async function translateMultipleText(
  textList: string[],
  targetLang: deepl.TargetLanguageCode,
  sourceLang: deepl.SourceLanguageCode = "fr"
): Promise<deepl.TextResult[]> {
  if (!process.env.DEEPL_AUTH_KEY) {
    throw new Error("DEEPL_AUTH_KEY is not defined");
  }

  const translator = new deepl.Translator(process.env.DEEPL_AUTH_KEY);
  const result = await translator.translateText(textList, sourceLang || null, targetLang);
  return result;
}
