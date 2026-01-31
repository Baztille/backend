import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ElectedPositionTypeDocument = HydratedDocument<ElectedPositionTypeMongo>;

// An elected position type (ex: "President" or "Member of the city council" or "Senator")
//
@Schema({ collection: "c_elected_position_type" })
export class ElectedPositionTypeMongo {
  _id: string;

  // TODO
}

export const ElectedPositionTypeSchema = SchemaFactory.createForClass(ElectedPositionTypeMongo);
