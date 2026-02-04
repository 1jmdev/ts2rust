// Codegen Statements - Generate Rust code for IR statements

import type { IRStatement, IRType } from '../ir/index.ts';
import { toSnakeCase, irTypeToRust, indent } from './types.ts';
import { generateExpression, generateExpressionWithType } from './expressions.ts';
import { getBuiltinMethod, getArrayMethod } from './builtins/index.ts';

// ============================================================================
// Statement Generation
// ============================================================================

/**
 * Generate Rust code for a statement
 */
export function generateStatement(
  stmt: IRStatement,
  indentLevel: number,
  isLastInNonVoidFn: boolean = false,
  returnType?: IRType
): string[] {
  const ind = indent(indentLevel);
  const lines: string[] = [];

  switch (stmt.kind) {
    case 'variable':
      lines.push(...generateVariable(stmt, ind));
      break;

    case 'assignment':
      lines.push(`${ind}${generateExpression(stmt.target)} = ${generateExpression(stmt.value)};`);
      break;

    case 'return':
      lines.push(...generateReturn(stmt, ind, isLastInNonVoidFn, returnType));
      break;

    case 'if':
      lines.push(...generateIf(stmt, ind, indentLevel, isLastInNonVoidFn, returnType));
      break;

    case 'while':
      lines.push(...generateWhile(stmt, ind, indentLevel, returnType));
      break;

    case 'for_in':
      lines.push(...generateForIn(stmt, ind, indentLevel, returnType));
      break;

    case 'switch':
      lines.push(...generateSwitch(stmt, ind, indentLevel, returnType));
      break;

    case 'match':
      lines.push(...generateMatch(stmt, ind, indentLevel, returnType));
      break;

    case 'break':
      lines.push(`${ind}break;`);
      break;

    case 'continue':
      lines.push(`${ind}continue;`);
      break;

    case 'expression':
      lines.push(...generateExpressionStmt(stmt, ind, isLastInNonVoidFn));
      break;

    case 'block':
      for (let i = 0; i < stmt.statements.length; i++) {
        const s = stmt.statements[i]!;
        const isLast = i === stmt.statements.length - 1;
        lines.push(...generateStatement(s, indentLevel, isLast && isLastInNonVoidFn, returnType));
      }
      break;
  }

  return lines;
}

// ============================================================================
// Variable Declaration
// ============================================================================

function generateVariable(
  stmt: IRStatement & { kind: 'variable' },
  ind: string
): string[] {
  const mutKeyword = stmt.mutable ? 'mut ' : '';
  const varName = toSnakeCase(stmt.name);
  const initStr = generateExpression(stmt.init);

  // Only specify type for arrays/complex types where inference might fail
  if (stmt.type.kind === 'array' || stmt.type.kind === 'struct' || stmt.type.kind === 'enum') {
    const typeStr = irTypeToRust(stmt.type);
    return [`${ind}let ${mutKeyword}${varName}: ${typeStr} = ${initStr};`];
  }

  return [`${ind}let ${mutKeyword}${varName} = ${initStr};`];
}

// ============================================================================
// Return Statement
// ============================================================================

function generateReturn(
  stmt: IRStatement & { kind: 'return' },
  ind: string,
  isLastInNonVoidFn: boolean,
  returnType?: IRType
): string[] {
  if (stmt.value) {
    const valueStr = generateExpressionWithType(stmt.value, returnType);
    if (isLastInNonVoidFn) {
      // Implicit return - no return keyword, no semicolon
      return [`${ind}${valueStr}`];
    }
    return [`${ind}return ${valueStr};`];
  }

  if (!isLastInNonVoidFn) {
    return [`${ind}return;`];
  }
  return [];
}

// ============================================================================
// Control Flow
// ============================================================================

function generateIf(
  stmt: IRStatement & { kind: 'if' },
  ind: string,
  indentLevel: number,
  isLastInNonVoidFn: boolean,
  returnType?: IRType
): string[] {
  const lines: string[] = [];
  const condStr = generateExpression(stmt.condition);

  lines.push(`${ind}if ${condStr} {`);

  for (let i = 0; i < stmt.thenBranch.length; i++) {
    const s = stmt.thenBranch[i]!;
    const isLast = i === stmt.thenBranch.length - 1;
    lines.push(
      ...generateStatement(s, indentLevel + 1, isLast && isLastInNonVoidFn && !stmt.elseBranch, returnType)
    );
  }

  if (stmt.elseBranch) {
    lines.push(`${ind}} else {`);
    for (let i = 0; i < stmt.elseBranch.length; i++) {
      const s = stmt.elseBranch[i]!;
      const isLast = i === stmt.elseBranch.length - 1;
      lines.push(...generateStatement(s, indentLevel + 1, isLast && isLastInNonVoidFn, returnType));
    }
  }

  lines.push(`${ind}}`);
  return lines;
}

function generateWhile(
  stmt: IRStatement & { kind: 'while' },
  ind: string,
  indentLevel: number,
  returnType?: IRType
): string[] {
  const lines: string[] = [];
  const condStr = generateExpression(stmt.condition);

  const label = stmt.label ? `'${stmt.label}: ` : '';
  lines.push(`${ind}${label}while ${condStr} {`);

  for (const s of stmt.body) {
    lines.push(...generateStatement(s, indentLevel + 1, false, returnType));
  }

  lines.push(`${ind}}`);
  return lines;
}

function generateForIn(
  stmt: IRStatement & { kind: 'for_in' },
  ind: string,
  indentLevel: number,
  returnType?: IRType
): string[] {
  const lines: string[] = [];
  const varName = toSnakeCase(stmt.variable);
  const iterable = generateExpression(stmt.iterable);
  const mutKeyword = stmt.mutable ? 'mut ' : '';

  const label = stmt.label ? `'${stmt.label}: ` : '';
  lines.push(`${ind}${label}for ${mutKeyword}${varName} in ${iterable}.iter() {`);

  for (const s of stmt.body) {
    lines.push(...generateStatement(s, indentLevel + 1, false, returnType));
  }

  lines.push(`${ind}}`);
  return lines;
}

// ============================================================================
// Switch/Match
// ============================================================================

function generateSwitch(
  stmt: IRStatement & { kind: 'switch' },
  ind: string,
  indentLevel: number,
  returnType?: IRType
): string[] {
  const lines: string[] = [];
  const discStr = generateExpression(stmt.discriminant);

  lines.push(`${ind}match ${discStr} {`);

  for (const caseItem of stmt.cases) {
    if (caseItem.value === undefined) {
      lines.push(`${ind}    _ => {`);
    } else {
      const valueStr = generateExpression(caseItem.value);
      lines.push(`${ind}    ${valueStr} => {`);
    }

    for (const s of caseItem.body) {
      lines.push(...generateStatement(s, indentLevel + 2, false, returnType));
    }

    lines.push(`${ind}    }`);
  }

  // Add catch-all if no default case
  const hasDefault = stmt.cases.some((c) => c.value === undefined);
  if (!hasDefault) {
    lines.push(`${ind}    _ => {}`);
  }

  lines.push(`${ind}}`);
  return lines;
}

function generateMatch(
  stmt: IRStatement & { kind: 'match' },
  ind: string,
  indentLevel: number,
  returnType?: IRType
): string[] {
  const lines: string[] = [];
  const exprStr = generateExpression(stmt.expression);

  lines.push(`${ind}match ${exprStr} {`);

  for (const arm of stmt.arms) {
    const pattern = generatePattern(arm.pattern);
    const guard = arm.guard ? ` if ${generateExpression(arm.guard)}` : '';

    lines.push(`${ind}    ${pattern}${guard} => {`);

    for (const s of arm.body) {
      lines.push(...generateStatement(s, indentLevel + 2, false, returnType));
    }

    lines.push(`${ind}    }`);
  }

  lines.push(`${ind}}`);
  return lines;
}

function generatePattern(pattern: import('../ir/index.ts').IRPattern): string {
  switch (pattern.kind) {
    case 'wildcard':
      return '_';
    case 'literal':
      return generateExpression(pattern.value);
    case 'identifier':
      const mut = pattern.mutable ? 'mut ' : '';
      return `${mut}${toSnakeCase(pattern.name)}`;
    case 'enum_variant':
      if (!pattern.bindings || pattern.bindings.length === 0) {
        return `${pattern.enumName}::${pattern.variant}`;
      }
      return `${pattern.enumName}::${pattern.variant}(${pattern.bindings.join(', ')})`;
    case 'struct':
      const fields = pattern.fields.map((f) => `${f.field}: ${f.binding}`).join(', ');
      return `${pattern.structName} { ${fields} }`;
    case 'tuple':
      return `(${pattern.elements.map(generatePattern).join(', ')})`;
    case 'or':
      return pattern.patterns.map(generatePattern).join(' | ');
  }
}

// ============================================================================
// Expression Statement
// ============================================================================

function generateExpressionStmt(
  stmt: IRStatement & { kind: 'expression' },
  ind: string,
  isLastInNonVoidFn: boolean
): string[] {
  const exprStr = generateExpression(stmt.expression);

  // Check for statement-only method calls
  if (stmt.expression.kind === 'method_call') {
    const methodCall = stmt.expression;
    if (methodCall.namespace) {
      const handler = getBuiltinMethod(methodCall.namespace, methodCall.method);
      if (handler?.isStatement) {
        return [`${ind}${exprStr};`];
      }
    } else {
      const arrayHandler = getArrayMethod(methodCall.method);
      if (arrayHandler?.isStatement) {
        return [`${ind}${exprStr};`];
      }
    }
  }

  if (isLastInNonVoidFn) {
    // Implicit return - no semicolon
    return [`${ind}${exprStr}`];
  }

  return [`${ind}${exprStr};`];
}
