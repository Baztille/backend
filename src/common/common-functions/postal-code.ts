/**
 * Retrieves characters from a given string based on specific conditions:
 * - If the length of the string is exactly 4, retrieves the first character.
 * - If the length of the string is exactly 5, retrieves the first two characters.
 * If the length of the string does not meet either condition, returns an error message.
 *
 * @param {string} string - The input string from which characters will be retrieved.
 * @returns {string} - The retrieved characters or an error message if conditions are not met.
 */
export function getIdDptByPostalCode(postalCode: string) {
  if (postalCode.length === 4) {
    return postalCode.charAt(0); // Retrieve the first character
  } else if (postalCode.length === 5) {
    const dptCode = postalCode.substring(0, 2); // Retrieve the first two characters
    if (dptCode === "20") {
      return detectDepartment(postalCode);
    }
    // DOM TOM & Polynésie Française / Nouvelle-Calédonie
    if (Number(dptCode) >= 97) {
      return postalCode.substring(0, 3);
    }
    return dptCode;
  } else {
    return "The length of the string does not meet the specified conditions.";
  }
}

/**
 * Function to detect if a French postal code belongs to Corse-du-Sud (2A) or Haute-Corse (2B).
 * Assumes the postal code received is in the format "20xxx".
 * @param codePostal The French postal code to be checked.
 * @returns The department (Corse-du-Sud or Haute-Corse) if the postal code belongs to Corsica, otherwise null.
 */
function detectDepartment(codePostal: string): string | null {
  const departmentsCorseDuSud = ["200", "201", "202", "203", "204", "205"];
  const departmentsHauteCorse = ["206", "207", "208", "209"];

  const departmentCode = codePostal.substring(0, 3);

  if (departmentsCorseDuSud.includes(departmentCode)) {
    return "2A";
  } else if (departmentsHauteCorse.includes(departmentCode)) {
    return "2B";
  } else {
    throw new Error("🚀 ~ The postal code does not correspond to any Corsican department: " + codePostal);
  }
}
