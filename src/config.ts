import { Connection } from "mongoose";
const USER_PROVIDER = "UserProvide";
const DB_PROVIDER = "DatabaseToken";
const SOCKET_PROVIDER = "SocketProvider";

export { DB_PROVIDER, SOCKET_PROVIDER, USER_PROVIDER };
export interface IProvider {
  provide: string;
  useFactory: (connection: Connection) => void;
  inject: Array<string>;
}
