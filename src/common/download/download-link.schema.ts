import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import * as mongoose from "mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";

/*********************************
 *
 * DownloadLinkMongo
 *
 * This is a document available for download (with a temporary link)
 */

export type DownloadLinkDocument = HydratedDocument<DownloadLinkMongo>;

@Schema({ collection: "download_link" })
export class DownloadLinkMongo {
  // Timestamp of when the link was created
  @Prop({
    type: Number,
    required: true
  })
  created: number;

  // Timestamp of when the link expires
  @Prop({
    type: Number,
    required: true
  })
  expires: number;

  // Downloaded file name = name of the file as it should appear for the user
  @Prop({
    type: String,
    required: true
  })
  filename: string;
}

export const DownloadLinkSchema = SchemaFactory.createForClass(DownloadLinkMongo);
