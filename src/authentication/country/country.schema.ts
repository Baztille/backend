import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type CountryDocument = HydratedDocument<CountryMongo>;

@Schema({ collection: "c_country", timestamps: true })
export class CountryMongo {
  _id: string;

  @Prop({
    type: Number
  })
  id: number;

  @Prop({
    type: String
  })
  alpha2: string;

  @Prop({
    type: String
  })
  alpha3: string;

  @Prop({
    type: String
  })
  ar: string;

  @Prop({
    type: String
  })
  bg: string;

  @Prop({
    type: String
  })
  cs: string;

  @Prop({
    type: String
  })
  da: string;

  @Prop({
    type: String
  })
  de: string;

  @Prop({
    type: String
  })
  el: string;

  @Prop({
    type: String
  })
  en: string;

  @Prop({
    type: String
  })
  eo: string;

  @Prop({
    type: String
  })
  es: string;

  @Prop({
    type: String
  })
  et: string;

  @Prop({
    type: String
  })
  eu: string;

  @Prop({
    type: String
  })
  fa: string;

  @Prop({
    type: String
  })
  fi: string;

  @Prop({
    type: String
  })
  fr: string;

  @Prop({
    type: String
  })
  hr: string;

  @Prop({
    type: String
  })
  hu: string;

  @Prop({
    type: String
  })
  hy: string;

  @Prop({
    type: String
  })
  it: string;

  @Prop({
    type: String
  })
  ja: string;

  @Prop({
    type: String
  })
  ko: string;

  @Prop({
    type: String
  })
  lt: string;

  @Prop({
    type: String
  })
  nl: string;

  @Prop({
    type: String
  })
  no: string;

  @Prop({
    type: String
  })
  pl: string;

  @Prop({
    type: String
  })
  pt: string;

  @Prop({
    type: String
  })
  ro: string;

  @Prop({
    type: String
  })
  ru: string;

  @Prop({
    type: String
  })
  sk: string;

  @Prop({
    type: String
  })
  sl: string;

  @Prop({
    type: String
  })
  sr: string;

  @Prop({
    type: String
  })
  sv: string;

  @Prop({
    type: String
  })
  th: string;

  @Prop({
    type: String
  })
  uk: string;

  @Prop({
    type: String
  })
  zh: string;

  @Prop({
    type: String
  })
  zhtw: string;
}

export const CountrySchema = SchemaFactory.createForClass(CountryMongo);
