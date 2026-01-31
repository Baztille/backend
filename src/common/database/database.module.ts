import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import * as dotenv from "dotenv";
import { DatabaseProviders } from "./database.provider";

dotenv.config();

@Module({
  imports: [MongooseModule.forRoot(process.env.DB_CONNECT ?? "DB_COMMONNECT not set")],
  providers: [...DatabaseProviders],
  exports: [...DatabaseProviders]
})
export class DatabaseModule {}
