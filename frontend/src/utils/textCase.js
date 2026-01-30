// Simple text case utilities to replace text-case package

/**
 * Converts a string to title case (first letter of each word capitalized)
 * @param {string} str - The string to convert
 * @returns {string} - The title cased string
 */
export function titleCase(str) {
  if (!str || typeof str !== "string") return "";
  return str.replace(
    /\w\S*/g,
    (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
}

/**
 * Converts a string to sentence case (first letter capitalized, rest lowercase)
 * @param {string} str - The string to convert
 * @returns {string} - The sentence cased string
 */
export function sentenceCase(str) {
  if (!str || typeof str !== "string") return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
