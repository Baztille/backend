import { BadRequestException } from "@nestjs/common";
import * as moment from "moment";
import { UserKey } from "src/profile/user/user.schema";
import { normalizeEmail } from "validator";

/**
 * The function `formatDate` takes a date string, converts it to a specific format (YYYY-MM-DD), and
 * returns the formatted date or null if an error occurs.
 * @param {string} date - The `formatDate` function takes a date string as input and uses the Moment.js
 * library to format it to 'YYYY-MM-DD' format after setting the time to the start of the day.
 * @returns The `formatDate` function is returning the input `date` string formatted as 'YYYY-MM-DD'
 * after setting the time to the start of the day using the moment library. If an error occurs during
 * this process, the function will return `null`.
 */
const formatDate = (date: string) => {
  try {
    return moment(date).startOf("day").format("YYYY-MM-DD");
  } catch (error) {
    return null;
  }
};

/**
 * The `splitDate` function takes a date string as input and returns an object with the day, month, and
 * year components extracted using the Moment.js library.
 * @param {string} date - The `splitDate` function takes a date string as input and uses the Moment.js
 * library to extract the day, month, and year components from the date. The function then returns an
 * object containing these components.
 * @returns The `splitDate` function is returning an object with the day, month, and year extracted
 * from the input date string using the moment library. If an error occurs during the date parsing, the
 * function will return `null`.
 */
const splitDate = (date: string) => {
  try {
    return {
      day: moment(date).get("date"),
      month: moment(date).get("month") + 1,
      year: moment(date).get("year")
    };
  } catch (error) {
    return null;
  }
};

/**
 * Generates a random 4-digit verification code for email/sms verification purposes.
 *
 * @returns A randomly generated 4-digit verification code as a string.
 */
const generateVerificationCode = () => {
  const min = 1000;
  const max = 9999;
  const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
  return randomNumber.toString();
};

/* Encodes a number into a base-28 representation using a specific alphabet,
 ** with a minimum of 3 characters.
 ** Note: this alphabet does not include 'I', 'O' or 'L' to avoid confusion with '1' and '0'.
 */
function encodeBase28(number) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const minLength = 3;
  let code = "";
  do {
    const remainder = number % alphabet.length;
    code = alphabet[remainder] + code;
    number = Math.floor(number / alphabet.length);
  } while (number > 0);

  // Pad with 'A' to reach minLength
  while (code.length < minLength) {
    code = "A" + code;
  }

  return code;
}

/* Escape special characters in a string for use in a regular expression
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* Escape special characters in a string for use in HTML
 */
function escapeHtml(unsafe) {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Transform email into key
 * Key is a visual way to identify a user, based on normalized email.
 * eg: for email "john.doe+baztille@gmail.com", key will be "johndoe#gmail.com"
 */
function emailToKey(email: string): UserKey {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    console.error("emailToKey: Invalid email format for email=", email);
    throw new BadRequestException("Invalid email format");
  }

  // Replace "@" by "#"
  const key = normalizedEmail.replace("@", "#");

  return key;
}

export { formatDate, generateVerificationCode, splitDate, encodeBase28, escapeRegExp, escapeHtml, emailToKey };
