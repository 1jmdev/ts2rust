// Parser Type Mapping - TypeScript types to IR types

import {
  type IRType,
  primitiveType,
  arrayType,
  structType,
  optionalType,
  tupleType,
} from '../ir/index.ts';

// ============================================================================
// TypeScript Type Registry
// ============================================================================

/**
 * Registry of known type names (structs, enums, type aliases)
 * This is populated during parsing when we encounter type declarations
 */
export class TypeRegistry {
  private structs: Set<string> = new Set();
  private enums: Set<string> = new Set();
  private typeAliases: Map<string, IRType> = new Map();

  registerStruct(name: string): void {
    this.structs.add(name);
  }

  registerEnum(name: string): void {
    this.enums.add(name);
  }

  registerTypeAlias(name: string, type: IRType): void {
    this.typeAliases.set(name, type);
  }

  isStruct(name: string): boolean {
    return this.structs.has(name);
  }

  isEnum(name: string): boolean {
    return this.enums.has(name);
  }

  resolveTypeAlias(name: string): IRType | undefined {
    return this.typeAliases.get(name);
  }

  isKnownType(name: string): boolean {
    return this.structs.has(name) || this.enums.has(name) || this.typeAliases.has(name);
  }
}

// Global type registry instance
export const globalTypeRegistry = new TypeRegistry();

// ============================================================================
// Type Mapping
// ============================================================================

/**
 * Map a TypeScript type string to an IR type
 * @param tsType - The TypeScript type string
 * @param forReturnType - If true, use owned types for returns (String instead of &str)
 * @param registry - Optional type registry for custom types
 */
export function mapTsTypeToIR(
  tsType: string,
  forReturnType: boolean = false,
  registry: TypeRegistry = globalTypeRegistry
): IRType {
  const normalized = tsType.trim();

  // Check for array types (both T[] and Array<T> syntax)
  if (normalized.endsWith('[]')) {
    const elementType = normalized.slice(0, -2);
    return arrayType(mapTsTypeToIR(elementType, forReturnType, registry));
  }

  const arrayMatch = normalized.match(/^Array<(.+)>$/);
  if (arrayMatch) {
    return arrayType(mapTsTypeToIR(arrayMatch[1]!, forReturnType, registry));
  }

  // Check for optional types (T | undefined or T?)
  if (normalized.includes(' | undefined') || normalized.includes(' | null')) {
    const innerType = normalized
      .replace(/ \| undefined/g, '')
      .replace(/ \| null/g, '')
      .trim();
    return optionalType(mapTsTypeToIR(innerType, forReturnType, registry));
  }

  // Check for tuple types: [T1, T2, ...]
  if (normalized.startsWith('[') && normalized.endsWith(']')) {
    const inner = normalized.slice(1, -1);
    const elements = parseTupleElements(inner);
    return tupleType(elements.map(e => mapTsTypeToIR(e, forReturnType, registry)));
  }

  // Check for known custom types (structs, enums)
  if (registry.isStruct(normalized)) {
    return structType(normalized);
  }

  if (registry.isEnum(normalized)) {
    return { kind: 'enum', name: normalized };
  }

  // Check for type aliases
  const aliasedType = registry.resolveTypeAlias(normalized);
  if (aliasedType) {
    return aliasedType;
  }

  // Primitive types
  switch (normalized) {
    case 'number':
      // Default to i32 for cleaner code - will be upgraded to f64 when needed
      return primitiveType('i32');
    case 'string':
      // For return types, use String (owned) to avoid lifetime issues
      return forReturnType ? primitiveType('String') : primitiveType('&str');
    case 'boolean':
      return primitiveType('bool');
    case 'void':
      return primitiveType('void');
    default:
      // Unknown type - treat as struct (will be validated later)
      return structType(normalized);
  }
}

/**
 * Parse tuple element types from a string like "number, string, boolean"
 */
function parseTupleElements(inner: string): string[] {
  const elements: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of inner) {
    if (char === '<' || char === '[' || char === '(') {
      depth++;
      current += char;
    } else if (char === '>' || char === ']' || char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      elements.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    elements.push(current.trim());
  }

  return elements;
}

// ============================================================================
// IR Type to Rust String
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
