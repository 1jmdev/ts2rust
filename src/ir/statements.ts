// IR Statement Nodes - All statement types in the IR

import type { IRType } from './types.ts';
import type { IRExpression } from './expressions.ts';

// ============================================================================
// Variable Declaration
// ============================================================================

export interface IRVariableDecl {
  kind: 'variable';
  name: string;
  type: IRType;
  mutable: boolean;
  init: IRExpression;
}

// ============================================================================
// Assignment
// ============================================================================

export interface IRAssignment {
  kind: 'assignment';
  target: IRExpression; // identifier, index, or property access
  value: IRExpression;
}

// ============================================================================
// Control Flow
// ============================================================================

export interface IRReturn {
  kind: 'return';
  value?: IRExpression;
}

export interface IRBreak {
  kind: 'break';
  label?: string;
}

export interface IRContinue {
  kind: 'continue';
  label?: string;
}

// ============================================================================
// Conditionals
// ============================================================================

export interface IRIf {
  kind: 'if';
  condition: IRExpression;
  thenBranch: IRStatement[];
  elseBranch?: IRStatement[];
}

// ============================================================================
// Loops
// ============================================================================

export interface IRWhile {
  kind: 'while';
  condition: IRExpression;
  body: IRStatement[];
  label?: string;
}

export interface IRForIn {
  kind: 'for_in';
  variable: string;
  mutable: boolean;
  iterable: IRExpression;
  body: IRStatement[];
  label?: string;
}

// ============================================================================
// Switch/Match
// ============================================================================

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

// ============================================================================
// Pattern Matching (Rust-style match)
// ============================================================================

export interface IRMatchArm {
  pattern: IRPattern;
  guard?: IRExpression;
  body: IRStatement[];
}

export interface IRMatch {
  kind: 'match';
  expression: IRExpression;
  arms: IRMatchArm[];
}

// Pattern types for match expressions
export type IRPattern =
  | { kind: 'wildcard' }
  | { kind: 'literal'; value: IRExpression }
  | { kind: 'identifier'; name: string; mutable?: boolean }
  | { kind: 'enum_variant'; enumName: string; variant: string; bindings?: string[] }
  | { kind: 'struct'; structName: string; fields: Array<{ field: string; binding: string }> }
  | { kind: 'tuple'; elements: IRPattern[] }
  | { kind: 'or'; patterns: IRPattern[] };

// ============================================================================
// Block
// ============================================================================

export interface IRBlock {
  kind: 'block';
  statements: IRStatement[];
}

// ============================================================================
// Expression Statement
// ============================================================================

export interface IRExpressionStmt {
  kind: 'expression';
  expression: IRExpression;
}

// ============================================================================
// Statement Union Type
// ============================================================================

export type IRStatement =
  | IRVariableDecl
  | IRAssignment
  | IRReturn
  | IRBreak
  | IRContinue
  | IRIf
  | IRWhile
  | IRForIn
  | IRSwitch
  | IRMatch
  | IRBlock
  | IRExpressionStmt;

// ============================================================================
// Statement Constructors
// ============================================================================

export function variableDecl(
  name: string,
  type: IRType,
  mutable: boolean,
  init: IRExpression
): IRVariableDecl {
  return { kind: 'variable', name, type, mutable, init };
}

export function assignment(target: IRExpression, value: IRExpression): IRAssignment {
  return { kind: 'assignment', target, value };
}

export function returnStmt(value?: IRExpression): IRReturn {
  return { kind: 'return', value };
}

export function breakStmt(label?: string): IRBreak {
  return { kind: 'break', label };
}

export function continueStmt(label?: string): IRContinue {
  return { kind: 'continue', label };
}

export function ifStmt(
  condition: IRExpression,
  thenBranch: IRStatement[],
  elseBranch?: IRStatement[]
): IRIf {
  return { kind: 'if', condition, thenBranch, elseBranch };
}

export function whileStmt(
  condition: IRExpression,
  body: IRStatement[],
  label?: string
): IRWhile {
  return { kind: 'while', condition, body, label };
}

export function forInStmt(
  variable: string,
  mutable: boolean,
  iterable: IRExpression,
  body: IRStatement[],
  label?: string
): IRForIn {
  return { kind: 'for_in', variable, mutable, iterable, body, label };
}

export function switchStmt(discriminant: IRExpression, cases: IRSwitchCase[]): IRSwitch {
  return { kind: 'switch', discriminant, cases };
}

export function matchStmt(expression: IRExpression, arms: IRMatchArm[]): IRMatch {
  return { kind: 'match', expression, arms };
}

export function block(statements: IRStatement[]): IRBlock {
  return { kind: 'block', statements };
}

export function expressionStmt(expression: IRExpression): IRExpressionStmt {
  return { kind: 'expression', expression };
}
