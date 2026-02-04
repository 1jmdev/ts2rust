// Intermediate Representation (IR) for ts2rust transpiler

// ============================================================================
// Types
// ============================================================================

export type IRType =
  | { kind: 'primitive'; name: 'f64' | 'String' | 'bool' | 'void' }
  | { kind: 'array'; elementType: IRType };

export function primitiveType(name: 'f64' | 'String' | 'bool' | 'void'): IRType {
  return { kind: 'primitive', name };
}

export function arrayType(elementType: IRType): IRType {
  return { kind: 'array', elementType };
}

// ============================================================================
// Expressions
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
  | IRArrayLiteral;

export interface IRLiteral {
  kind: 'literal';
  value: number | string | boolean;
  type: IRType;
}

export interface IRIdentifier {
  kind: 'identifier';
  name: string;
}

export interface IRBinaryOp {
  kind: 'binary';
  operator: string; // +, -, *, /, %, <, >, <=, >=, ==, !=, &&, ||
  left: IRExpression;
  right: IRExpression;
}

export interface IRUnaryOp {
  kind: 'unary';
  operator: string; // !, -
  operand: IRExpression;
}

export interface IRCall {
  kind: 'call';
  callee: string;
  args: IRExpression[];
  isConsoleLog?: boolean;
}

export interface IRMethodCall {
  kind: 'method_call';
  object: IRExpression;
  method: string;
  args: IRExpression[];
  /** The namespace if this is a builtin like console.log, Math.abs */
  namespace?: string;
}

export interface IRIndex {
  kind: 'index';
  object: IRExpression;
  index: IRExpression;
}

export interface IRPropertyAccess {
  kind: 'property';
  object: IRExpression;
  property: string;
}

export interface IRArrayLiteral {
  kind: 'array_literal';
  elements: IRExpression[];
  elementType: IRType;
}

// ============================================================================
// Statements
// ============================================================================

export type IRStatement =
  | IRVariableDecl
  | IRAssignment
  | IRReturn
  | IRIf
  | IRWhile
  | IRSwitch
  | IRBreak
  | IRExpressionStmt
  | IRBlock;

export interface IRVariableDecl {
  kind: 'variable';
  name: string;
  type: IRType;
  mutable: boolean;
  init: IRExpression;
}

export interface IRAssignment {
  kind: 'assignment';
  target: IRExpression; // identifier or index expression
  value: IRExpression;
}

export interface IRReturn {
  kind: 'return';
  value?: IRExpression;
}

export interface IRIf {
  kind: 'if';
  condition: IRExpression;
  thenBranch: IRStatement[];
  elseBranch?: IRStatement[];
}

export interface IRWhile {
  kind: 'while';
  condition: IRExpression;
  body: IRStatement[];
}

export interface IRSwitchCase {
  /** The value to match, or undefined for default case */
  value?: IRExpression;
  /** Statements in this case */
  body: IRStatement[];
  /** Whether this case falls through to the next (no break) */
  fallthrough: boolean;
}

export interface IRSwitch {
  kind: 'switch';
  discriminant: IRExpression;
  cases: IRSwitchCase[];
}

export interface IRBreak {
  kind: 'break';
}

export interface IRExpressionStmt {
  kind: 'expression';
  expression: IRExpression;
}

export interface IRBlock {
  kind: 'block';
  statements: IRStatement[];
}

// ============================================================================
// Top-level declarations
// ============================================================================

export interface IRParam {
  name: string;
  type: IRType;
}

export interface IRFunction {
  name: string;
  params: IRParam[];
  returnType: IRType;
  body: IRStatement[];
}

export interface IRProgram {
  functions: IRFunction[];
}
