import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema } from "mongoose";
import { ReportStatus, ReportType } from "src/common/enum";

export type ReportDocument = HydratedDocument<ReportMongo>;

@Schema({ collection: "u_report", timestamps: true })
export class ReportMongo {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: "User"
  })
  reporterId: string;

  @Prop({
    type: String,
    required: true
  })
  type: ReportType;

  @Prop({
    type: String,
    trim: true
  })
  description: string;

  @Prop({
    type: String,
    default: ReportStatus.PENDING
  })
  status: ReportStatus;

  @Prop({
    type: String,
    required: true
  })
  targetId: string;
}

export const ReportSchema = SchemaFactory.createForClass(ReportMongo);
