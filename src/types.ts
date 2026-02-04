// Type mapping from TypeScript to Rust IR types

import { type IRType, primitiveType, arrayType } from './ir.ts';

/**
 * Map a TypeScript type string to an IR type
 */
export function mapTsTypeToIR(tsType: string): IRType {
  // Normalize the type string
  const normalized = tsType.trim();

  // Check for array types (both T[] and Array<T> syntax)
  if (normalized.endsWith('[]')) {
    const elementType = normalized.slice(0, -2);
    return arrayType(mapTsTypeToIR(elementType));
  }

  const arrayMatch = normalized.match(/^Array<(.+)>$/);
  if (arrayMatch) {
    return arrayType(mapTsTypeToIR(arrayMatch[1]!));
  }

  // Primitive types
  switch (normalized) {
    case 'number':
      return primitiveType('f64');
    case 'string':
      return primitiveType('String');
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
 * Check if an IR type is numeric (f64)
 */
export function isNumericType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === 'f64';
}

/**
 * Check if an IR type is a string
 */
export function isStringType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === 'String';
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
