import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type TerritoryTypeDocument = HydratedDocument<TerritoryTypeMongo>;

@Schema({ collection: "c_territory_type" })
export class TerritoryTypeMongo {
  _id: string;

  // Public name of the territory type
  // (ex: "Departement")
  @Prop({
    type: String,
    required: true
  })
  name: string;

  // Display weight:
  // Used by user interface to determine which territory to display first when there are several.
  // Territory types with higher weight will be considered more important and displayed first.
  @Prop({
    type: Number
  })
  displayWeight: number;
}

export const TerritoryTypeSchema = SchemaFactory.createForClass(TerritoryTypeMongo);
