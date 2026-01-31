import * as mongoose from "mongoose";
import { DB_PROVIDER } from "../../config";

export const DatabaseProviders = [
  {
    provide: DB_PROVIDER,
    useFactory: async () => {
      (mongoose as any).Promise = global.Promise;
      //mongoose.set('debug', true);

      if (!process.env.DB_CONNECT) throw new Error("DB_CONNECT not set");

      return await mongoose.connect(process.env.DB_CONNECT, {
        autoCreate: true,
        autoIndex: true
      });
    }
  }
];
