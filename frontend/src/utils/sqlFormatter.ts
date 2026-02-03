/**
 * Simple SQL formatter utility
 * Formats SQL queries for better readability
 */

export function formatSql(sql: string): string {
  if (!sql || typeof sql !== 'string') {
    return '';
  }

  // Remove extra whitespace
  let formatted = sql.trim();

  // Add newlines after major SQL keywords for better readability
  const keywords = [
    'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT JOIN', 'RIGHT JOIN',
    'INNER JOIN', 'OUTER JOIN', 'ON', 'GROUP BY', 'HAVING',
    'ORDER BY', 'LIMIT', 'OFFSET', 'UNION', 'INTERSECT', 'EXCEPT'
  ];

  keywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
    formatted = formatted.replace(regex, (match) => {
      // Don't add newline if it's already at the start of the string
      return match.toUpperCase();
    });
  });

  return formatted;
}
