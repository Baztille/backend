import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { MissionCategory } from "./types/mission-category.enum";
import { MissionType } from "./types/mission-type";

/*********************************
 *
 * Mission
 *
 * A mission is a task that a user can perform to earn points
 * Mission data collection gather all the missions that are available in the app
 *
 */

export type MissionDocument = HydratedDocument<MissionMongo>;

@Schema({ collection: "m_mission" })
export class MissionMongo {
  _id: string;

  // Mission category
  @Prop({
    type: String,
    enum: MissionCategory,
    required: true
  })
  category: MissionCategory;

  // Mission type
  //(= logic to trigger action success)
  @Prop({
    type: String,
    enum: MissionType,
    required: true
  })
  type: MissionType;

  // Mission type argument
  //(usually, number of XXX that user should reach to complete the mission - XXX depends on the mission type)
  @Prop({
    type: Number,
    required: false
  })
  typeArg: number;

  // Mission slug
  // (= unique identifier of the mission)
  // Is always: <category>_<type>_<typeArg>
  @Prop({
    type: String,
    required: true
  })
  slug: string;

  // Mission points
  //(points that user will earn when he complete the mission)
  @Prop({
    type: Number,
    required: true
  })
  points: number;

  // Level prerequisite
  //(user should reach this level to be able to view and/or complete the mission)
  @Prop({
    type: Number,
    required: false,
    default: 0
  })
  minUserLevel: number;

  // Mission prerequisite
  // Note: a default prerequisite for all missions is to have completed the previous mission with same type (with previous typeArg)
  // Prerequiste is a list of mission slugs
  // (user should complete all the missions in this list to be able to view and/or complete the mission)
  @Prop({
    type: [String],
    required: false,
    default: []
  })
  prerequisite: string[];

  // Hidden mission
  //(= not displayed until the user complete it))
  @Prop({
    type: Boolean,
    required: true,
    default: false
  })
  hidden: boolean;

  // Display priority
  //(= priority to display the mission in the list of missions)
  // Higher number = displayed first
  @Prop({
    type: Number,
    required: false,
    default: 0
  })
  displayPriority: number;
}

export const MissionSchema = SchemaFactory.createForClass(MissionMongo);
MissionSchema.index({ slug: 1 }, { unique: true });
