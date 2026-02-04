// Ownership Analysis - Analyze variable usage for Rust ownership semantics
//
// This module analyzes the IR to determine:
// - Which variables are moved vs borrowed
// - Where .clone() is actually needed
// - Where references should be used instead of owned values

import type {
  IRProgram,
  IRFunction,
  IRStatement,
  IRExpression,
  IRType,
} from '../ir/index.ts';
import { isCopyType, needsClone } from '../ir/index.ts';

// ============================================================================
// Variable Usage Tracking
// ============================================================================

export interface VariableUsage {
  name: string;
  type: IRType;
  /** Number of times the variable is read */
  reads: number;
  /** Number of times the variable is written/assigned */
  writes: number;
  /** Is the variable moved (last use consumes ownership)? */
  moved: boolean;
  /** Line numbers where variable is used */
  usageLocations: number[];
}

export interface FunctionAnalysis {
  name: string;
  variables: Map<string, VariableUsage>;
  /** Variables that need .clone() because they're used after being passed */
  needsClone: Set<string>;
  /** Variables that can be passed by reference instead of by value */
  canBorrow: Set<string>;
}

// ============================================================================
// Analysis Functions
// ============================================================================

/**
 * Analyze a program for ownership semantics
 */
export function analyzeOwnership(program: IRProgram): Map<string, FunctionAnalysis> {
  const results = new Map<string, FunctionAnalysis>();

  for (const func of program.functions) {
    results.set(func.name, analyzeFunction(func));
  }

  return results;
}

/**
 * Analyze a single function for ownership
 */
export function analyzeFunction(func: IRFunction): FunctionAnalysis {
  const variables = new Map<string, VariableUsage>();
  const needsCloneSet = new Set<string>();
  const canBorrow = new Set<string>();

  // Track all variable declarations and uses
  collectVariables(func.body, variables);

  // Determine which variables need clone vs can be moved
  for (const [name, usage] of variables) {
    if (needsClone(usage.type)) {
      // If variable is used more than once, we need to clone all but the last use
      if (usage.reads > 1) {
        needsCloneSet.add(name);
      }
    }

    // If variable is only read once and never written after declaration,
    // we can move it instead of cloning
    if (usage.reads === 1 && usage.writes === 1) {
      canBorrow.add(name);
    }
  }

  return {
    name: func.name,
    variables,
    needsClone: needsCloneSet,
    canBorrow,
  };
}

/**
 * Collect all variable declarations and usages from statements
 */
function collectVariables(
  statements: IRStatement[],
  variables: Map<string, VariableUsage>
): void {
  for (const stmt of statements) {
    collectFromStatement(stmt, variables);
  }
}

function collectFromStatement(
  stmt: IRStatement,
  variables: Map<string, VariableUsage>
): void {
  switch (stmt.kind) {
    case 'variable':
      // New variable declaration
      variables.set(stmt.name, {
        name: stmt.name,
        type: stmt.type,
        reads: 0,
        writes: 1,
        moved: false,
        usageLocations: [],
      });
      collectFromExpression(stmt.init, variables);
      break;

    case 'assignment':
      collectFromExpression(stmt.target, variables, true);
      collectFromExpression(stmt.value, variables);
      break;

    case 'return':
      if (stmt.value) {
        collectFromExpression(stmt.value, variables);
      }
      break;

    case 'if':
      collectFromExpression(stmt.condition, variables);
      collectVariables(stmt.thenBranch, variables);
      if (stmt.elseBranch) {
        collectVariables(stmt.elseBranch, variables);
      }
      break;

    case 'while':
      collectFromExpression(stmt.condition, variables);
      collectVariables(stmt.body, variables);
      break;

    case 'for_in':
      collectFromExpression(stmt.iterable, variables);
      // Loop variable is implicitly declared
      collectVariables(stmt.body, variables);
      break;

    case 'switch':
      collectFromExpression(stmt.discriminant, variables);
      for (const c of stmt.cases) {
        if (c.value) {
          collectFromExpression(c.value, variables);
        }
        collectVariables(c.body, variables);
      }
      break;

    case 'match':
      collectFromExpression(stmt.expression, variables);
      for (const arm of stmt.arms) {
        if (arm.guard) {
          collectFromExpression(arm.guard, variables);
        }
        collectVariables(arm.body, variables);
      }
      break;

    case 'expression':
      collectFromExpression(stmt.expression, variables);
      break;

    case 'block':
      collectVariables(stmt.statements, variables);
      break;
  }
}

function collectFromExpression(
  expr: IRExpression,
  variables: Map<string, VariableUsage>,
  isWrite: boolean = false
): void {
  switch (expr.kind) {
    case 'identifier':
      const usage = variables.get(expr.name);
      if (usage) {
        if (isWrite) {
          usage.writes++;
        } else {
          usage.reads++;
        }
      }
      break;

    case 'binary':
      collectFromExpression(expr.left, variables);
      collectFromExpression(expr.right, variables);
      break;

    case 'unary':
      collectFromExpression(expr.operand, variables);
      break;

    case 'call':
      for (const arg of expr.args) {
        collectFromExpression(arg, variables);
      }
      break;

    case 'method_call':
      collectFromExpression(expr.object, variables);
      for (const arg of expr.args) {
        collectFromExpression(arg, variables);
      }
      break;

    case 'index':
      collectFromExpression(expr.object, variables);
      collectFromExpression(expr.index, variables);
      break;

    case 'property':
      collectFromExpression(expr.object, variables);
      break;

    case 'array_literal':
      for (const elem of expr.elements) {
        collectFromExpression(elem, variables);
      }
      break;

    case 'struct_literal':
      for (const field of expr.fields) {
        collectFromExpression(field.value, variables);
      }
      break;

    case 'tuple_literal':
      for (const elem of expr.elements) {
        collectFromExpression(elem, variables);
      }
      break;

    case 'ternary':
      collectFromExpression(expr.condition, variables);
      collectFromExpression(expr.thenExpr, variables);
      collectFromExpression(expr.elseExpr, variables);
      break;

    case 'cast':
      collectFromExpression(expr.expression, variables);
      break;
  }
}

// ============================================================================
// Optimization Suggestions
// ============================================================================

export interface OptimizationSuggestion {
  type: 'remove_clone' | 'add_borrow' | 'use_move';
  variable: string;
  message: string;
}

/**
 * Generate optimization suggestions based on analysis
 */
export function suggestOptimizations(analysis: FunctionAnalysis): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];

  for (const [name, usage] of analysis.variables) {
    // Suggest removing clone if variable is only used once
    if (analysis.needsClone.has(name) && usage.reads === 1) {
      suggestions.push({
        type: 'remove_clone',
        variable: name,
        message: `Variable '${name}' is only used once - can move instead of clone`,
      });
    }

    // Suggest borrowing for read-only uses
    if (usage.writes === 1 && usage.reads > 0 && !isCopyType(usage.type)) {
      suggestions.push({
        type: 'add_borrow',
        variable: name,
        message: `Variable '${name}' is never modified - consider passing by reference`,
      });
    }
  }

  return suggestions;
}
