import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type ElectedRepresentativeDocument = HydratedDocument<ElectedRepresentativeMongo>;

// An elected representative (or a list of representatives, with exactly the same position and electorate)
// There may be member of Baztille or not
//

@Schema({ collection: "u_elected_representative" })
export class ElectedRepresentativeMongo {
  _id: string;

  // TODO
}

export const ElectedRepresentativeSchema = SchemaFactory.createForClass(ElectedRepresentativeMongo);
