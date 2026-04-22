/**
 * SQL formatter utility
 * Uses sql-formatter library for proper indentation and keyword formatting
 */
import { format } from 'sql-formatter';

export function formatSql(sql: string): string {
  if (!sql || typeof sql !== 'string') {
    return '';
  }

  try {
    return format(sql.trim(), {
      language: 'sql',
      tabWidth: 2,
      keywordCase: 'upper',
      linesBetweenQueries: 2,
      expressionWidth: 60,
    });
  } catch {
    // Fallback: return original if formatter fails (e.g. invalid SQL fragment)
    return sql.trim();
  }
}
