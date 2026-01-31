import { Connection } from "mongoose";
import { DB_PROVIDER, USER_PROVIDER } from "src/config";
import { UserMongo, UserSchema } from "src/profile/user/user.schema";

export const AuthProvider = [
  {
    provide: USER_PROVIDER,
    useFactory: (connection: Connection) => connection.model(UserMongo.name, UserSchema),
    inject: [DB_PROVIDER]
  }
];
