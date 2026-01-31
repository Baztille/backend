import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

export type MaintenanceDocument = HydratedDocument<MaintenanceMongo>;

/* This is a collection with a single document that contains the maintenance value
 *  = the current maintenance state of the application.
 */

@Schema({ collection: "maintenance" })
export class MaintenanceMongo {
  _id: string;

  // Is it possible to vote right now?
  @Prop({
    type: Boolean,
    default: true
  })
  canVote: boolean;

  // Is vote cycle active?
  @Prop({
    type: Boolean,
    default: true
  })
  voteCycle: boolean;

  // Maintenance message for votes if not available
  @Prop({
    type: String,
    default: ""
  })
  votesMaintenanceMessage: string;
}

export const MaintenanceSchema = SchemaFactory.createForClass(MaintenanceMongo);
