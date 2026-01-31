import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

export type GlobalDocument = HydratedDocument<GlobalMongo>;

@Schema({ collection: "global" })
export class GlobalMongo {
  _id: string;

  // Global value (any type)
  @Prop({
    type: Object
  })
  value: any;
}

export const GlobalSchema = SchemaFactory.createForClass(GlobalMongo);
