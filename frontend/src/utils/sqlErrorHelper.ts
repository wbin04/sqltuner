/**
 * SQL Error Helper
 * Provides suggestions and fixes for common SQL errors
 */

export interface SQLErrorSuggestion {
  title: string;
  description: string;
  example: string;
}

/**
 * Extract clean error message from backend response
 */
export function extractErrorMessage(error: any): string {
  const errorMsg = error?.response?.data?.detail || error?.message || 'Unknown error';
  
  // Extract key error info from backend error message
  const match = errorMsg.match(/Statement \d+ failed: \((.*?)\) (.*?)(?:\[SQL:|$)/s);
  if (match) {
    const [, errorType, errorDesc] = match;
    return `${errorType}\n${errorDesc.trim()}`;
  }
  
  return errorMsg;
}

/**
 * Get suggestion for common SQL errors
 */
export function getSQLErrorSuggestion(error: any): SQLErrorSuggestion | null {
  const errorMsg = error?.response?.data?.detail || error?.message || '';
  
  // Interval with string literal
  if (errorMsg.includes('invalid input syntax for type interval')) {
    return {
      title: '💡 Date/Interval Type Casting Issue',
      description: 'Cast the date string to DATE or TIMESTAMP before using with INTERVAL:',
      example: `-- ❌ Wrong: '2016-08-15' - INTERVAL '1 day'
-- ✅ Correct: '2016-08-15'::date - INTERVAL '1 day'
-- ✅ Or: DATE '2016-08-15' - INTERVAL '1 day'
-- ✅ Or: TIMESTAMP '2016-08-15' - INTERVAL '1 day'`,
    };
  }
  
  // Undefined column
  if (errorMsg.includes('column') && errorMsg.includes('does not exist')) {
    const columnMatch = errorMsg.match(/column "([^"]+)" does not exist/);
    const columnName = columnMatch ? columnMatch[1] : '';
    
    return {
      title: '💡 Column Not Found',
      description: `The column "${columnName}" doesn't exist in the table. Check:`,
      example: `-- 1. Verify column name spelling
-- 2. Check if you need to qualify with table name
-- 3. Ensure you're querying the correct table
-- 4. Column names are case-sensitive when quoted`,
    };
  }
  
  // Undefined table
  if (errorMsg.includes('relation') && errorMsg.includes('does not exist')) {
    const tableMatch = errorMsg.match(/relation "([^"]+)" does not exist/);
    const tableName = tableMatch ? tableMatch[1] : '';
    
    return {
      title: '💡 Table Not Found',
      description: `The table "${tableName}" doesn't exist. Check:`,
      example: `-- 1. Verify table name spelling
-- 2. Check if table exists in current database
-- 3. Ensure schema name is included if needed (schema.table)
-- 4. Table names are case-sensitive when quoted`,
    };
  }
  
  // Undefined function or operator
  if ((errorMsg.includes('function') || errorMsg.includes('operator')) && errorMsg.includes('does not exist')) {
    return {
      title: '💡 Function/Operator Not Found',
      description: `The function or operator might not be supported in this database type (e.g. SQLite vs PostgreSQL) or argument types are mismatched. Check:`,
      example: `-- 1. Are you using a database-specific function? (e.g. YEAR() vs EXTRACT(YEAR FROM ...))
-- 2. Are argument types correct? You might need to cast explicit types (e.g. value::integer)
-- 3. Verify function name spelling`,
    };
  }
  
  // Syntax error
  if (errorMsg.includes('syntax error')) {
    return {
      title: '💡 SQL Syntax Error',
      description: 'There is a syntax error in your SQL query. Common issues:',
      example: `-- 1. Missing comma between column names
-- 2. Unclosed quotes or parentheses
-- 3. Reserved keyword used without quotes
-- 4. Invalid SQL keyword or structure`,
    };
  }
  
  // Permission denied
  if (errorMsg.includes('permission denied')) {
    return {
      title: '💡 Permission Denied',
      description: 'You don\'t have permission to perform this operation. Check:',
      example: `-- 1. Do you have SELECT/INSERT/UPDATE/DELETE privileges?
-- 2. Contact your database administrator
-- 3. Verify you're connected with the correct user`,
    };
  }
  
  // Division by zero
  if (errorMsg.includes('division by zero')) {
    return {
      title: '💡 Division by Zero',
      description: 'Attempting to divide by zero. Use NULLIF to prevent:',
      example: `-- ❌ Wrong: value / count
-- ✅ Correct: value / NULLIF(count, 0)
-- This returns NULL instead of error when count = 0`,
    };
  }
  
  // Invalid input syntax for type
  if (errorMsg.includes('invalid input syntax for type')) {
    return {
      title: '💡 Type Conversion Error',
      description: 'The value cannot be converted to the expected type. Check:',
      example: `-- 1. Ensure data format matches column type
-- 2. Use explicit casting: value::type or CAST(value AS type)
-- 3. Validate input data format
-- 4. Check for NULL or empty values`,
    };
  }
  
  // Ambiguous column
  if (errorMsg.includes('ambiguous')) {
    return {
      title: '💡 Ambiguous Column Reference',
      description: 'Column appears in multiple tables. Qualify with table name/alias:',
      example: `-- ❌ Wrong: SELECT id FROM users u JOIN orders o ON ...
-- ✅ Correct: SELECT u.id FROM users u JOIN orders o ON ...
-- Or use table aliases to clarify which table's column`,
    };
  }
  
  return null;
}

/**
 * Check if error is a SQL syntax error
 */
export function isSQLSyntaxError(error: any): boolean {
  const errorMsg = error?.response?.data?.detail || error?.message || '';
  return errorMsg.toLowerCase().includes('syntax error');
}

/**
 * Check if error is a permission error
 */
export function isPermissionError(error: any): boolean {
  const errorMsg = error?.response?.data?.detail || error?.message || '';
  return errorMsg.toLowerCase().includes('permission denied');
}
