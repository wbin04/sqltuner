import { format } from 'sql-formatter';

/**
 * SQL Formatter Utility
 * Uses sql-formatter library for robust SQL beautification with compact style
 */

/**
 * Formats SQL query with compact pretty-print style
 * @param sql - Raw SQL query string
 * @returns Formatted SQL string (compact, readable)
 */
export function formatSql(sql: string): string {
    if (!sql || sql.trim().length === 0) {
        return sql;
    }

    try {
        let formatted = format(sql, {
            language: 'postgresql',    // Standard SQL dialect
            tabWidth: 2,                // Indent with 2 spaces (more compact)
            keywordCase: 'upper',       // Uppercase keywords: SELECT, FROM, WHERE...
            linesBetweenQueries: 2,
            
            // --- IMPORTANT CONFIG FOR COMPACT FORMATTING ---
            denseOperators: true,       // Keep operators tight (a=b instead of a = b)
            expressionWidth: 60,        // Try to keep lines under 60 chars on one line
        });

        // --- POST-PROCESSING TO IMPROVE UI ---
        // sql-formatter loves to break SELECT and * into separate lines.
        // This regex combines 'SELECT \n *' into 'SELECT *' for cleaner look.
        formatted = formatted.replace(/SELECT\s+[\r\n]+\s+\*/gi, 'SELECT *');
        
        // Combine 'COUNT( \n *)' into 'COUNT(*)'
        formatted = formatted.replace(/COUNT\s*\(\s+[\r\n]+\s+\*\s+\)/gi, 'COUNT(*)');

        return formatted;
    } catch (error) {
        // Fallback: return original SQL if formatting fails
        console.warn('[SQL Formatter] Failed to format SQL:', error);
        return sql;
    }
}
