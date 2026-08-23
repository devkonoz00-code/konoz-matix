/**
 * Escapes special characters for use in regular expressions.
 * Protects MongoDB $regex queries against ReDoS (Regular Expression Denial of Service)
 * and syntax errors caused by arbitrary user input.
 *
 * @param {string} str - Raw user input
 * @returns {string} - Escaped string safe for RegExp construction
 */
function escapeRegex(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

module.exports = {
  escapeRegex,
};
