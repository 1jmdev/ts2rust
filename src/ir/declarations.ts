// IR Top-Level Declarations - Functions, Structs, Enums, and the Program

import type { IRType } from './types.ts';
import type { IRStatement } from './statements.ts';

// ============================================================================
// Struct Declarations
// ============================================================================

export interface IRStructField {
  name: string;
  type: IRType;
  /** Is this field public? (default: true in generated Rust) */
  public: boolean;
}

export interface IRStruct {
  kind: 'struct';
  name: string;
  fields: IRStructField[];
  /** Derive macros to apply */
  derives: string[];
}

// ============================================================================
// Enum Declarations
// ============================================================================

/** A simple enum variant with no data */
export interface IREnumVariantUnit {
  kind: 'unit';
  name: string;
  /** Explicit discriminant value */
  value?: number;
}

/** A tuple-style enum variant: Variant(T1, T2) */
export interface IREnumVariantTuple {
  kind: 'tuple';
  name: string;
  fields: IRType[];
}

/** A struct-style enum variant: Variant { field: T } */
export interface IREnumVariantStruct {
  kind: 'struct';
  name: string;
  fields: IRStructField[];
}

export type IREnumVariantDef = IREnumVariantUnit | IREnumVariantTuple | IREnumVariantStruct;

export interface IREnum {
  kind: 'enum';
  name: string;
  variants: IREnumVariantDef[];
  /** Derive macros to apply */
  derives: string[];
}

// ============================================================================
// Type Alias Declarations
// ============================================================================

export interface IRTypeAlias {
  kind: 'type_alias';
  name: string;
  type: IRType;
}

// ============================================================================
// Function Declarations
// ============================================================================

export interface IRParam {
  name: string;
  type: IRType;
}

export interface IRFunction {
  kind: 'function';
  name: string;
  params: IRParam[];
  returnType: IRType;
  body: IRStatement[];
  /** Is this a public function? */
  public: boolean;
}

// ============================================================================
// Implementation Blocks (for methods on structs/enums)
// ============================================================================

export interface IRMethod {
  name: string;
  params: IRParam[];
  returnType: IRType;
  body: IRStatement[];
  /** Method receiver: 'self', '&self', '&mut self' */
  receiver: 'self' | '&self' | '&mut self';
  public: boolean;
}

export interface IRImpl {
  kind: 'impl';
  typeName: string;
  methods: IRMethod[];
}

// ============================================================================
// Top-Level Declaration Union
// ============================================================================

export type IRDeclaration =
  | IRStruct
  | IREnum
  | IRTypeAlias
  | IRFunction
  | IRImpl;

// ============================================================================
// Program - Root of the IR
// ============================================================================

export interface IRProgram {
  /** All top-level declarations */
  declarations: IRDeclaration[];
  
  /** 
   * Convenience accessor for functions
   * @deprecated Use declarations and filter by kind instead
   */
  functions: IRFunction[];
  
  /**
   * Convenience accessor for structs
   * @deprecated Use declarations and filter by kind instead
   */
  structs: IRStruct[];
  
  /**
   * Convenience accessor for enums
   * @deprecated Use declarations and filter by kind instead
   */
  enums: IREnum[];
}

// ============================================================================
// Declaration Constructors
// ============================================================================

export function structDecl(
  name: string,
  fields: IRStructField[],
  derives: string[] = ['Debug', 'Clone']
): IRStruct {
  return { kind: 'struct', name, fields, derives };
}

export function structField(name: string, type: IRType, isPublic: boolean = true): IRStructField {
  return { name, type, public: isPublic };
}

export function enumDecl(
  name: string,
  variants: IREnumVariantDef[],
  derives: string[] = ['Debug', 'Clone', 'PartialEq']
): IREnum {
  return { kind: 'enum', name, variants, derives };
}

export function enumVariantUnit(name: string, value?: number): IREnumVariantUnit {
  return { kind: 'unit', name, value };
}

export function enumVariantTuple(name: string, fields: IRType[]): IREnumVariantTuple {
  return { kind: 'tuple', name, fields };
}

export function enumVariantStruct(name: string, fields: IRStructField[]): IREnumVariantStruct {
  return { kind: 'struct', name, fields };
}

export function typeAliasDecl(name: string, type: IRType): IRTypeAlias {
  return { kind: 'type_alias', name, type };
}

export function functionDecl(
  name: string,
  params: IRParam[],
  returnType: IRType,
  body: IRStatement[],
  isPublic: boolean = false
): IRFunction {
  return { kind: 'function', name, params, returnType, body, public: isPublic };
}

export function param(name: string, type: IRType): IRParam {
  return { name, type };
}

export function implBlock(typeName: string, methods: IRMethod[]): IRImpl {
  return { kind: 'impl', typeName, methods };
}

export function method(
  name: string,
  params: IRParam[],
  returnType: IRType,
  body: IRStatement[],
  receiver: 'self' | '&self' | '&mut self' = '&self',
  isPublic: boolean = true
): IRMethod {
  return { name, params, returnType, body, receiver, public: isPublic };
}

export function program(declarations: IRDeclaration[]): IRProgram {
  const functions = declarations.filter((d): d is IRFunction => d.kind === 'function');
  const structs = declarations.filter((d): d is IRStruct => d.kind === 'struct');
  const enums = declarations.filter((d): d is IREnum => d.kind === 'enum');
  
  return { declarations, functions, structs, enums };
}
