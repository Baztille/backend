import * as CryptoJS from "crypto-js";
import { logInfo, logError } from "./logger";

/**
 * Encrypts an array of string data using AES encryption algorithm.
 * @param data - Array of strings to be encrypted.
 * @returns Encrypted string representing the encrypted data.
 */
export function encryptChoice(data: string[]) {
  logInfo(JSON.stringify(data));
  logInfo(typeof JSON.stringify(data));

  if (!process.env.CRYPTO_SECRET_KEY) {
    logError("WARNING: Crypto secret key is undefined !!");
  }

  return CryptoJS.AES.encrypt(JSON.stringify(data), process.env.CRYPTO_SECRET_KEY).toString();
}

/**
 * Decrypts an encrypted string using AES decryption algorithm.
 * @param encryptedData - Encrypted string to be decrypted.
 * @returns Decrypted array of strings.
 */
export function decryptChoice(encryptedData: string) {
  if (!process.env.CRYPTO_SECRET_KEY) {
    logError("WARNING: Crypto secret key is undefined !!");
  }

  const bytes = CryptoJS.AES.decrypt(encryptedData, process.env.CRYPTO_SECRET_KEY);
  const decryptedData = JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
  return decryptedData;
}
