// IR Expression Nodes - All expression types in the IR

import type { IRType } from './types.ts';

// ============================================================================
// Literal Expressions
// ============================================================================

export interface IRLiteral {
  kind: 'literal';
  value: number | string | boolean;
  type: IRType;
  /** For number literals, track if the original was an integer */
  isInteger?: boolean;
}

// ============================================================================
// Identifier Expressions
// ============================================================================

export interface IRIdentifier {
  kind: 'identifier';
  name: string;
  /** Resolved type (populated during analysis phase) */
  resolvedType?: IRType;
}

// ============================================================================
// Operator Expressions
// ============================================================================

export interface IRBinaryOp {
  kind: 'binary';
  operator: string; // +, -, *, /, %, <, >, <=, >=, ==, !=, &&, ||
  left: IRExpression;
  right: IRExpression;
}

export interface IRUnaryOp {
  kind: 'unary';
  operator: string; // !, -, +
  operand: IRExpression;
}

// ============================================================================
// Call Expressions
// ============================================================================

export interface IRCall {
  kind: 'call';
  callee: string;
  args: IRExpression[];
}

export interface IRMethodCall {
  kind: 'method_call';
  object: IRExpression;
  method: string;
  args: IRExpression[];
  /** The namespace if this is a builtin like console.log, Math.abs */
  namespace?: string;
  /** Resolved object type (populated during analysis phase) */
  objectType?: IRType;
}

// ============================================================================
// Access Expressions
// ============================================================================

export interface IRIndex {
  kind: 'index';
  object: IRExpression;
  index: IRExpression;
}

export interface IRPropertyAccess {
  kind: 'property';
  object: IRExpression;
  property: string;
  /** Resolved object type (populated during analysis phase) */
  objectType?: IRType;
  /** Resolved type of this expression (populated during analysis phase) */
  resolvedType?: IRType;
}

// ============================================================================
// Composite Expressions
// ============================================================================

export interface IRArrayLiteral {
  kind: 'array_literal';
  elements: IRExpression[];
  elementType: IRType;
}

export interface IRStructLiteral {
  kind: 'struct_literal';
  structName: string;
  fields: Array<{
    name: string;
    value: IRExpression;
  }>;
}

export interface IRTupleLiteral {
  kind: 'tuple_literal';
  elements: IRExpression[];
}

// ============================================================================
// Enum Expressions
// ============================================================================

export interface IREnumVariant {
  kind: 'enum_variant';
  enumName: string;
  variant: string;
  /** Associated data for tuple/struct variants */
  data?: IRExpression[];
}

// ============================================================================
// Closure/Lambda Expressions
// ============================================================================

export interface IRClosure {
  kind: 'closure';
  params: Array<{
    name: string;
    type?: IRType;
  }>;
  body: IRExpression | IRClosureBody;
  returnType?: IRType;
}

/** Block body for multi-statement closures */
export interface IRClosureBody {
  kind: 'closure_body';
  statements: import('./statements.ts').IRStatement[];
  returnExpr?: IRExpression;
}

// ============================================================================
// Ternary/Conditional Expressions
// ============================================================================

export interface IRTernary {
  kind: 'ternary';
  condition: IRExpression;
  thenExpr: IRExpression;
  elseExpr: IRExpression;
}

// ============================================================================
// Cast/Conversion Expressions
// ============================================================================

export interface IRCast {
  kind: 'cast';
  expression: IRExpression;
  targetType: IRType;
}

// ============================================================================
// Expression Union Type
// ============================================================================

export type IRExpression =
  | IRLiteral
  | IRIdentifier
  | IRBinaryOp
  | IRUnaryOp
  | IRCall
  | IRMethodCall
  | IRIndex
  | IRPropertyAccess
  | IRArrayLiteral
  | IRStructLiteral
  | IRTupleLiteral
  | IREnumVariant
  | IRClosure
  | IRTernary
  | IRCast;

// ============================================================================
// Expression Constructors
// ============================================================================

export function literal(value: number | string | boolean, type: IRType, isInteger?: boolean): IRLiteral {
  return { kind: 'literal', value, type, isInteger };
}

export function identifier(name: string): IRIdentifier {
  return { kind: 'identifier', name };
}

export function binaryOp(operator: string, left: IRExpression, right: IRExpression): IRBinaryOp {
  return { kind: 'binary', operator, left, right };
}

export function unaryOp(operator: string, operand: IRExpression): IRUnaryOp {
  return { kind: 'unary', operator, operand };
}

export function call(callee: string, args: IRExpression[]): IRCall {
  return { kind: 'call', callee, args };
}

export function methodCall(
  object: IRExpression, 
  method: string, 
  args: IRExpression[], 
  namespace?: string
): IRMethodCall {
  return { kind: 'method_call', object, method, args, namespace };
}

export function index(object: IRExpression, idx: IRExpression): IRIndex {
  return { kind: 'index', object, index: idx };
}

export function propertyAccess(object: IRExpression, property: string): IRPropertyAccess {
  return { kind: 'property', object, property };
}

export function arrayLiteral(elements: IRExpression[], elementType: IRType): IRArrayLiteral {
  return { kind: 'array_literal', elements, elementType };
}

export function structLiteral(
  structName: string, 
  fields: Array<{ name: string; value: IRExpression }>
): IRStructLiteral {
  return { kind: 'struct_literal', structName, fields };
}

export function tupleLiteral(elements: IRExpression[]): IRTupleLiteral {
  return { kind: 'tuple_literal', elements };
}

export function enumVariant(enumName: string, variant: string, data?: IRExpression[]): IREnumVariant {
  return { kind: 'enum_variant', enumName, variant, data };
}

export function ternary(
  condition: IRExpression, 
  thenExpr: IRExpression, 
  elseExpr: IRExpression
): IRTernary {
  return { kind: 'ternary', condition, thenExpr, elseExpr };
}

export function cast(expression: IRExpression, targetType: IRType): IRCast {
  return { kind: 'cast', expression, targetType };
}
