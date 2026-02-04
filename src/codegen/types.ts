// Codegen Types - Utilities for Rust code generation

import type { IRType } from '../ir/index.ts';
import { isOwnedStringType } from '../ir/index.ts';

// ============================================================================
// Naming Conventions
// ============================================================================

/**
 * Convert camelCase to snake_case
 */
export function toSnakeCase(name: string): string {
  // Handle already snake_case names
  if (name.includes('_') && !name.match(/[A-Z]/)) {
    return name;
  }

  // Convert camelCase/PascalCase to snake_case
  return name
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()
    .replace(/^_/, ''); // Remove leading underscore if present
}

/**
 * Convert to PascalCase (for struct/enum names)
 */
export function toPascalCase(name: string): string {
  return name
    .split(/[_\s-]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

// ============================================================================
// Type to Rust String
// ============================================================================

/**
 * Convert IR type to Rust type string
 */
export function irTypeToRust(type: IRType): string {
  switch (type.kind) {
    case 'primitive':
      return type.name === 'void' ? '()' : type.name;

    case 'array':
      return `Vec<${irTypeToRust(type.elementType)}>`;

    case 'struct':
      return type.name;

    case 'enum':
      return type.name;

    case 'tuple':
      return `(${type.elements.map(irTypeToRust).join(', ')})`;

    case 'optional':
      return `Option<${irTypeToRust(type.innerType)}>`;

    case 'reference':
      return type.mutable
        ? `&mut ${irTypeToRust(type.innerType)}`
        : `&${irTypeToRust(type.innerType)}`;

    case 'function':
      const params = type.params.map(irTypeToRust).join(', ');
      const ret = irTypeToRust(type.returnType);
      return `fn(${params}) -> ${ret}`;

    default:
      throw new Error(`Unknown IR type kind: ${(type as IRType).kind}`);
  }
}

// ============================================================================
// String Utilities
// ============================================================================

/**
 * Escape a string for Rust string literals
 */
export function escapeString(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * Create indentation string
 */
export function indent(level: number): string {
  return '    '.repeat(level);
}

// ============================================================================
// Expression Type Coercion
// ============================================================================

import type { IRExpression } from '../ir/index.ts';

/**
 * Check if an expression is a string literal (&str)
 */
export function isStrLiteral(expr: IRExpression): boolean {
  return expr.kind === 'literal' && typeof expr.value === 'string';
}

/**
 * Check if expression needs string conversion (for &str -> String)
 */
export function mightNeedStringConversion(expr: IRExpression): boolean {
  return (
    (expr.kind === 'literal' && typeof expr.value === 'string') ||
    expr.kind === 'identifier'
  );
}

/**
 * Wrap expression with .to_string() if needed for type coercion
 */
export function coerceToString(exprStr: string, expr: IRExpression, targetType?: IRType): string {
  if (targetType && isOwnedStringType(targetType) && mightNeedStringConversion(expr)) {
    return `${exprStr}.to_string()`;
  }
  return exprStr;
}
