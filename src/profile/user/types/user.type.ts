///////////////////////////////////////////////////////////////////////////////////
///// User interface
///// = main way to access to user data in the code
/////

import { Territory } from "src/countrymodel/types/territory.type";
import { UserMongo } from "../user.schema";

export interface User extends Omit<UserMongo, "pollingStationId"> {
  // Polling station is populated by its corresponding territory
  pollingStationId: Territory;

  // Populated territories infos
  territoriesInfos: Territory[];
}
