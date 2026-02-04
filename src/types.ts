// Type mapping from TypeScript to Rust IR types

import { type IRType, primitiveType, arrayType } from './ir.ts';

/**
 * Map a TypeScript type string to an IR type
 * @param tsType - The TypeScript type string
 * @param forReturnType - If true, use owned types for returns (String instead of &str)
 */
export function mapTsTypeToIR(tsType: string, forReturnType: boolean = false): IRType {
  // Normalize the type string
  const normalized = tsType.trim();

  // Check for array types (both T[] and Array<T> syntax)
  if (normalized.endsWith('[]')) {
    const elementType = normalized.slice(0, -2);
    return arrayType(mapTsTypeToIR(elementType, forReturnType));
  }

  const arrayMatch = normalized.match(/^Array<(.+)>$/);
  if (arrayMatch) {
    return arrayType(mapTsTypeToIR(arrayMatch[1]!, forReturnType));
  }

  // Primitive types
  switch (normalized) {
    case 'number':
      // Default to i32 for cleaner code - will be upgraded to f64 when needed
      return primitiveType('i32');
    case 'string':
      // For return types, use String (owned) to avoid lifetime issues
      // For local variables, we let Rust infer (usually &str for literals)
      return forReturnType ? primitiveType('String') : primitiveType('&str');
    case 'boolean':
      return primitiveType('bool');
    case 'void':
      return primitiveType('void');
    default:
      throw new Error(`Unsupported type: ${tsType}`);
  }
}

/**
 * Convert IR type to Rust type string
 */
export function irTypeToRust(type: IRType): string {
  if (type.kind === 'primitive') {
    if (type.name === 'void') {
      return '()';
    }
    return type.name;
  }

  if (type.kind === 'array') {
    return `Vec<${irTypeToRust(type.elementType)}>`;
  }

  throw new Error(`Unknown IR type kind`);
}

/**
 * Check if an IR type is void
 */
export function isVoidType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === 'void';
}

/**
 * Check if an IR type is numeric (f64 or i32)
 */
export function isNumericType(type: IRType): boolean {
  return type.kind === 'primitive' && (type.name === 'f64' || type.name === 'i32');
}

/**
 * Check if an IR type is an integer (i32)
 */
export function isIntegerType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === 'i32';
}

/**
 * Check if an IR type is a float (f64)
 */
export function isFloatType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === 'f64';
}

/**
 * Check if an IR type is a string (String or &str)
 */
export function isStringType(type: IRType): boolean {
  return type.kind === 'primitive' && (type.name === 'String' || type.name === '&str');
}

/**
 * Check if an IR type is an owned string (String)
 */
export function isOwnedStringType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === 'String';
}

/**
 * Check if an IR type is a string reference (&str)
 */
export function isStrRefType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === '&str';
}

/**
 * Check if an IR type is boolean
 */
export function isBoolType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === 'bool';
}

/**
 * Check if an IR type is an array
 */
export function isArrayType(type: IRType): boolean {
  return type.kind === 'array';
}
