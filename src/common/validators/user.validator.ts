import * as mongoose from "mongoose";
import { UserSchema } from "src/profile/user/user.schema";
import { checkStringExistence } from "./custom.validator";
import { logInfo } from "src/utils/logger";

const UserModel = mongoose.model("User", UserSchema);

/**
 * The function `isValidCity` in TypeScript checks if a city name is valid by verifying its existence
 * as a string.
 * @param {string} city - A string representing the name of a city.
 * @returns A boolean value is being returned, indicating whether the input city string is valid or
 * not.
 */
export function isValidCity(city: string): boolean {
  return checkStringExistence(city);
}

/**
 * The function `isValidAddress` in TypeScript checks if a given address string exists.
 * @param {string} address - The `isValidAddress` function takes a string parameter `address` and
 * checks if the address is valid. The implementation of the function relies on another function
 * `checkStringExistence` to determine the validity of the address. If you provide me with the specific
 * requirements or format that constitutes a valid address,
 * @returns The function `isValidAddress` is returning the result of calling the `checkStringExistence`
 * function with the `address` parameter.
 */
export function isValidAddress(address: string): boolean {
  return checkStringExistence(address);
}

/**
 * The function `isValidCountry` in TypeScript checks if a given country string exists.
 * @param {string} country - It looks like you are trying to create a function `isValidCountry` that
 * checks if a given country is valid. However, the implementation of the function is missing. You
 * mentioned a function `checkStringExistence`, but its implementation is not provided.
 * @returns A boolean value indicating whether the country string is valid or not.
 */
export function isValidCountry(country: string): boolean {
  return checkStringExistence(country);
}

/**
 * The function `isValidDate` in TypeScript checks if a given input is a valid date.
 * @param {any} data - The `data` parameter in the `isValidDate` function is expected to be a value
 * that can be converted into a Date object. This function checks if the provided `data` is a valid
 * date by attempting to create a new Date object from it and then checking if the resulting date is
 * not NaN
 * @returns The function `isValidDate` is returning a boolean value. It returns `true` if the input
 * `data` can be successfully converted to a valid date using the `Date` constructor, and `false` if
 * the input is not a valid date.
 */
export function isValidDate(data: string | number | Date): boolean {
  return !isNaN(new Date(data).getTime());
}

/**
 * The function `isValidInviter` checks if a user with a specific ID exists and returns a boolean
 * indicating its validity.
 * @param {string} userId - The `userId` parameter is a string that represents the unique identifier of
 * a user. It is used to query the `UserModel` to check if a user with that specific identifier exists,
 * and the function `isValidInviter` returns a boolean value indicating whether the user is a valid
 * inviter or
 * @returns The `isValidInviter` function returns a Promise that resolves to a boolean value. The
 * function checks if a user with the specified `userId` exists in the UserModel. If the user is found,
 * it returns `true`, otherwise it returns `false`. If an error occurs during the process, the function
 * catches the error, logs it, and returns `false`.
 */
export async function isValidInviter(userId: string): Promise<boolean> {
  try {
    const user = await UserModel.findById(userId);
    return !!user;
  } catch (error) {
    logInfo("Error in isValidInviter:", error);
    return false;
  }
}
