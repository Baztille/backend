import { ApiProperty } from "@nestjs/swagger";

export class CountryDto {
  @ApiProperty({ description: "Country unique identifier", example: "64f1c2e9d8b5a1f2c3d4e5f6" })
  _id: string;

  @ApiProperty({ description: "Numeric country code", example: 250 })
  id: number;

  @ApiProperty({ description: "ISO 3166-1 alpha-2 country code", example: "FR" })
  alpha2: string;

  @ApiProperty({ description: "ISO 3166-1 alpha-3 country code", example: "FRA" })
  alpha3: string;

  @ApiProperty({ description: "Country name in Arabic", example: "فرنسا" })
  ar: string;

  @ApiProperty({ description: "Country name in Bulgarian", example: "Франция" })
  bg: string;

  @ApiProperty({ description: "Country name in Czech", example: "Francie" })
  cs: string;

  @ApiProperty({ description: "Country name in Danish", example: "Frankrig" })
  da: string;

  @ApiProperty({ description: "Country name in German", example: "Frankreich" })
  de: string;

  @ApiProperty({ description: "Country name in Greek", example: "Γαλλία" })
  el: string;

  @ApiProperty({ description: "Country name in English", example: "France" })
  en: string;

  @ApiProperty({ description: "Country name in Esperanto", example: "Francio" })
  eo: string;

  @ApiProperty({ description: "Country name in Spanish", example: "Francia" })
  es: string;

  @ApiProperty({ description: "Country name in Estonian", example: "Prantsusmaa" })
  et: string;

  @ApiProperty({ description: "Country name in Basque", example: "Frantzia" })
  eu: string;

  @ApiProperty({ description: "Country name in Persian", example: "فرانسه" })
  fa: string;

  @ApiProperty({ description: "Country name in Finnish", example: "Ranska" })
  fi: string;

  @ApiProperty({ description: "Country name in French", example: "France" })
  fr: string;

  @ApiProperty({ description: "Country name in Croatian", example: "Francuska" })
  hr: string;

  @ApiProperty({ description: "Country name in Hungarian", example: "Franciaország" })
  hu: string;

  @ApiProperty({ description: "Country name in Armenian", example: "Ֆրանսիա" })
  hy: string;

  @ApiProperty({ description: "Country name in Italian", example: "Francia" })
  it: string;

  @ApiProperty({ description: "Country name in Japanese", example: "フランス" })
  ja: string;

  @ApiProperty({ description: "Country name in Korean", example: "프랑스" })
  ko: string;

  @ApiProperty({ description: "Country name in Lithuanian", example: "Prancūzija" })
  lt: string;

  @ApiProperty({ description: "Country name in Dutch", example: "Frankrijk" })
  nl: string;

  @ApiProperty({ description: "Country name in Norwegian", example: "Frankrike" })
  no: string;

  @ApiProperty({ description: "Country name in Polish", example: "Francja" })
  pl: string;

  @ApiProperty({ description: "Country name in Portuguese", example: "França" })
  pt: string;

  @ApiProperty({ description: "Country name in Romanian", example: "Franța" })
  ro: string;

  @ApiProperty({ description: "Country name in Russian", example: "Франция" })
  ru: string;

  @ApiProperty({ description: "Country name in Slovak", example: "Francúzsko" })
  sk: string;

  @ApiProperty({ description: "Country name in Slovenian", example: "Francija" })
  sl: string;

  @ApiProperty({ description: "Country name in Serbian", example: "Француска" })
  sr: string;

  @ApiProperty({ description: "Country name in Swedish", example: "Frankrike" })
  sv: string;

  @ApiProperty({ description: "Country name in Thai", example: "ฝรั่งเศส" })
  th: string;

  @ApiProperty({ description: "Country name in Ukrainian", example: "Франція" })
  uk: string;

  @ApiProperty({ description: "Country name in Chinese (Simplified)", example: "法国" })
  zh: string;

  @ApiProperty({ description: "Country name in Chinese (Traditional)", example: "法國" })
  zhtw: string;
}
