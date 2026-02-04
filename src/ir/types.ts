// IR Type Definitions - Core type system for the transpiler
// Supports primitives, arrays, structs, enums, tuples, and optionals

// ============================================================================
// Primitive Type Names
// ============================================================================

export type PrimitiveName = 
  | 'f64' 
  | 'i32' 
  | 'String' 
  | '&str' 
  | 'bool' 
  | 'void' 
  | 'usize'
  | 'i64'
  | 'u32'
  | 'u64'
  | 'char';

// ============================================================================
// IR Types - Extensible type system
// ============================================================================

/** Primitive types (numbers, strings, booleans, etc.) */
export interface IRPrimitiveType {
  kind: 'primitive';
  name: PrimitiveName;
}

/** Array/Vec types */
export interface IRArrayType {
  kind: 'array';
  elementType: IRType;
}

/** Struct/Interface types - reference by name */
export interface IRStructType {
  kind: 'struct';
  name: string;
}

/** Enum types - reference by name */
export interface IREnumType {
  kind: 'enum';
  name: string;
}

/** Tuple types */
export interface IRTupleType {
  kind: 'tuple';
  elements: IRType[];
}

/** Optional types (Option<T> in Rust) */
export interface IROptionalType {
  kind: 'optional';
  innerType: IRType;
}

/** Reference types (&T, &mut T) */
export interface IRReferenceType {
  kind: 'reference';
  innerType: IRType;
  mutable: boolean;
}

/** Function type (for closures/callbacks) */
export interface IRFunctionType {
  kind: 'function';
  params: IRType[];
  returnType: IRType;
}

/** Union of all IR types */
export type IRType =
  | IRPrimitiveType
  | IRArrayType
  | IRStructType
  | IREnumType
  | IRTupleType
  | IROptionalType
  | IRReferenceType
  | IRFunctionType;

// ============================================================================
// Type Constructors - Helper functions to create types
// ============================================================================

export function primitiveType(name: PrimitiveName): IRPrimitiveType {
  return { kind: 'primitive', name };
}

export function arrayType(elementType: IRType): IRArrayType {
  return { kind: 'array', elementType };
}

export function structType(name: string): IRStructType {
  return { kind: 'struct', name };
}

export function enumType(name: string): IREnumType {
  return { kind: 'enum', name };
}

export function tupleType(elements: IRType[]): IRTupleType {
  return { kind: 'tuple', elements };
}

export function optionalType(innerType: IRType): IROptionalType {
  return { kind: 'optional', innerType };
}

export function referenceType(innerType: IRType, mutable: boolean = false): IRReferenceType {
  return { kind: 'reference', innerType, mutable };
}

export function functionType(params: IRType[], returnType: IRType): IRFunctionType {
  return { kind: 'function', params, returnType };
}

// ============================================================================
// Type Predicates - Check type kinds
// ============================================================================

export function isPrimitiveType(type: IRType): type is IRPrimitiveType {
  return type.kind === 'primitive';
}

export function isArrayType(type: IRType): type is IRArrayType {
  return type.kind === 'array';
}

export function isStructType(type: IRType): type is IRStructType {
  return type.kind === 'struct';
}

export function isEnumType(type: IRType): type is IREnumType {
  return type.kind === 'enum';
}

export function isTupleType(type: IRType): type is IRTupleType {
  return type.kind === 'tuple';
}

export function isOptionalType(type: IRType): type is IROptionalType {
  return type.kind === 'optional';
}

export function isReferenceType(type: IRType): type is IRReferenceType {
  return type.kind === 'reference';
}

export function isFunctionType(type: IRType): type is IRFunctionType {
  return type.kind === 'function';
}

// ============================================================================
// Specific Type Checks
// ============================================================================

export function isVoidType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === 'void';
}

export function isNumericType(type: IRType): boolean {
  return type.kind === 'primitive' && 
    ['f64', 'i32', 'i64', 'u32', 'u64', 'usize'].includes(type.name);
}

export function isIntegerType(type: IRType): boolean {
  return type.kind === 'primitive' && 
    ['i32', 'i64', 'u32', 'u64', 'usize'].includes(type.name);
}

export function isFloatType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === 'f64';
}

export function isStringType(type: IRType): boolean {
  return type.kind === 'primitive' && (type.name === 'String' || type.name === '&str');
}

export function isOwnedStringType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === 'String';
}

export function isStrRefType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === '&str';
}

export function isBoolType(type: IRType): boolean {
  return type.kind === 'primitive' && type.name === 'bool';
}

// ============================================================================
// Type Utilities
// ============================================================================

/** Check if a type is Copy (can be implicitly copied without .clone()) */
export function isCopyType(type: IRType, knownCopyEnums: Set<string> = new Set()): boolean {
  if (type.kind === 'primitive') {
    // String is not Copy, but &str is
    return type.name !== 'String';
  }
  if (type.kind === 'tuple') {
    return type.elements.every(t => isCopyType(t, knownCopyEnums));
  }
  if (type.kind === 'reference') {
    return !type.mutable; // &T is Copy, &mut T is not
  }
  if (type.kind === 'enum') {
    // Check if this enum is known to be Copy
    return knownCopyEnums.has(type.name);
  }
  // Arrays and structs are typically not Copy
  return false;
}

/** Check if all fields of a struct are Copy types */
export function canStructDeriveCopy(
  fields: Array<{ type: IRType }>,
  knownCopyEnums: Set<string> = new Set()
): boolean {
  return fields.every(field => isCopyType(field.type, knownCopyEnums));
}

/** Check if a type needs to be cloned when passed by value */
export function needsClone(type: IRType, knownCopyEnums: Set<string> = new Set()): boolean {
  return !isCopyType(type, knownCopyEnums);
}

/** Get the inner type for container types */
export function getInnerType(type: IRType): IRType | undefined {
  switch (type.kind) {
    case 'array':
      return type.elementType;
    case 'optional':
      return type.innerType;
    case 'reference':
      return type.innerType;
    default:
      return undefined;
  }
}
