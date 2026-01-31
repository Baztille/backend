/**
 * The function `checkStringExistence` checks if a string is not undefined, not null, and has a length
 * greater than 0 after trimming.
 * @param {string | undefined | null} str - The `str` parameter in the `checkStringExistence` function
 * is a string type that can also be `undefined` or `null`. The function checks if the string is not
 * `undefined`, not `null`, and has a length greater than 0 after trimming any whitespace.
 * @returns A boolean value is being returned.
 */
export function checkStringExistence(str: string | undefined | null): boolean {
  return str !== undefined && str !== null && str.trim().length > 0;
}
