import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { UserKey } from "./user.schema";

/*********************************
 *
 * Deleted user
 * A deleted user is a user that has been deleted from the system (account removed)
 * We keep some deleted user infos during 7 days to prevent user from creating a new account with same email/phone number
 *
 */

export type DeletedUserDocument = HydratedDocument<DeletedUserMongo>;

@Schema({ collection: "u_deleted_user" })
export class DeletedUserMongo {
  _id: string;

  // Deleted user email
  @Prop({
    type: String,
    required: true
  })
  key: UserKey;

  // Deleted user phone number
  @Prop({
    type: String,
    sparse: true,
    trim: true,
    required: false
  })
  phoneNumber: string;

  // Deleted user deletion date
  @Prop({
    type: Number,
    required: true
  })
  deletedAt: number;
}

export const DeletedUserSchema = SchemaFactory.createForClass(DeletedUserMongo);
DeletedUserSchema.index({ email: 1 }, { unique: false }); // Needed to search by email on registration (note: not unique because multiple users can delete their account with same email after 7 days)
DeletedUserSchema.index({ phoneNumber: 1 }, { unique: false }); // Needed to search by phone number on registration (note: not unique because multiple users can delete their account with same phone number after 7 days)
