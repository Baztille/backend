// must be imported in relative path
import mongoose from "mongoose";
import { CountryMongo, CountrySchema } from "src/authentication/country/country.schema";
import { TerritoryTypeMongo, TerritoryTypeSchema } from "src/countrymodel/schema/territory-type.schema";
import { TerritoryMongo, TerritorySchema } from "src/countrymodel/schema/territory.schema";
import { UserMongo, UserSchema } from "src/profile/user/user.schema";

// Defining models here makes it easier to use them in migrations

export const getModels = async () => {
  // Since we are using the same connection, we can just return the model
  await mongoose.connect(process.env.DB_CONNECT ?? "mongodb://127.0.0.1:27017/baztille_db");

  const CountryModel = mongoose.model(CountryMongo.name, CountrySchema);
  const TerritoryModel = mongoose.model(TerritoryMongo.name, TerritorySchema);
  const TerritoryTypesModel = mongoose.model(TerritoryTypeMongo.name, TerritoryTypeSchema);
  const UserModel = mongoose.model(UserMongo.name, UserSchema);

  return {
    CountryModel,
    TerritoryModel,
    TerritoryTypesModel,
    UserModel
  };
};

export const getMongoose = async () => {
  return await mongoose.connect(process.env.DB_CONNECT ?? "mongodb://127.0.0.1:27017/baztille_db");
};
