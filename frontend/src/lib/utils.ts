import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Utility function to merge Tailwind CSS classes
 * Combines clsx for conditional classes and tailwind-merge for deduplication
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse SQL type string into base type and arguments
 * Examples:
 * - "VARCHAR(255)" -> { type: "VARCHAR", args: "255" }
 * - "DECIMAL(10,2)" -> { type: "DECIMAL", args: "10,2" }
 * - "JSONB" -> { type: "JSONB", args: null }
 */
export function parseSQLType(rawString: string): { type: string; args: string | null } {
  const trimmed = rawString.trim().toUpperCase();

  // Match pattern like VARCHAR(255) or DECIMAL(10,2)
  const match = trimmed.match(/^(\w+)\(([^)]+)\)$/);

  if (match) {
    return {
      type: match[1],
      args: match[2]
    };
  }

  // No parentheses, just the type
  return {
    type: trimmed,
    args: null
  };
}

/**
 * Construct full SQL type string from base type and arguments
 * Examples:
 * - { type: "VARCHAR", args: "255" } -> "VARCHAR(255)"
 * - { type: "JSONB", args: null } -> "JSONB"
 */
export function constructSQLType(type: string, args: string | null): string {
  if (args) {
    return `${type}(${args})`;
  }
  return type;
}
