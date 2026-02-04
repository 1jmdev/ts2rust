// Parser Statements - Parse TypeScript statements to IR

import {
  Statement,
  Block,
  SyntaxKind,
  VariableDeclaration,
  VariableDeclarationKind,
  VariableStatement,
  ExpressionStatement,
  ReturnStatement,
  IfStatement,
  WhileStatement,
  ForStatement,
  ForOfStatement,
  SwitchStatement,
  CaseClause,
  BinaryExpression,
  Expression,
} from 'ts-morph';

import {
  type IRStatement,
  type IRSwitchCase,
  type IRExpression,
  primitiveType,
} from '../ir/index.ts';

import { parseExpression } from './expressions.ts';
import { mapTsTypeToIR, type TypeRegistry, globalTypeRegistry } from './types.ts';

// ============================================================================
// Statement Parsing
// ============================================================================

export function parseStatement(
  stmt: Statement,
  registry: TypeRegistry = globalTypeRegistry
): IRStatement {
  const kind = stmt.getKind();

  switch (kind) {
    case SyntaxKind.VariableStatement: {
      return parseVariableStatement(stmt as VariableStatement, registry);
    }

    case SyntaxKind.ExpressionStatement: {
      return parseExpressionStatement(stmt as ExpressionStatement);
    }

    case SyntaxKind.ReturnStatement: {
      const retStmt = stmt as ReturnStatement;
      const expr = retStmt.getExpression();
      return {
        kind: 'return',
        value: expr ? parseExpression(expr) : undefined,
      };
    }

    case SyntaxKind.IfStatement: {
      return parseIfStatement(stmt as IfStatement, registry);
    }

    case SyntaxKind.WhileStatement: {
      return parseWhileStatement(stmt as WhileStatement, registry);
    }

    case SyntaxKind.ForStatement: {
      return parseForStatement(stmt as ForStatement, registry);
    }

    case SyntaxKind.ForOfStatement: {
      return parseForOfStatement(stmt as ForOfStatement, registry);
    }

    case SyntaxKind.SwitchStatement: {
      return parseSwitchStatement(stmt as SwitchStatement, registry);
    }

    case SyntaxKind.BreakStatement: {
      return { kind: 'break' };
    }

    case SyntaxKind.ContinueStatement: {
      return { kind: 'continue' };
    }

    case SyntaxKind.Block: {
      return {
        kind: 'block',
        statements: parseBlock(stmt as Block, registry),
      };
    }

    default:
      throw new Error(`Unsupported statement kind: ${stmt.getKindName()}`);
  }
}

export function parseBlock(
  block: Block,
  registry: TypeRegistry = globalTypeRegistry
): IRStatement[] {
  return block.getStatements().map((s) => parseStatement(s, registry));
}

// ============================================================================
// Variable Statement
// ============================================================================

function parseVariableStatement(
  varStmt: VariableStatement,
  registry: TypeRegistry
): IRStatement {
  const declList = varStmt.getDeclarationList();
  const decls = declList.getDeclarations();

  if (decls.length !== 1) {
    throw new Error('Multiple variable declarations in one statement not supported');
  }

  const decl = decls[0]!;
  return parseVariableDeclaration(decl, declList.getDeclarationKind(), registry);
}

function parseVariableDeclaration(
  decl: VariableDeclaration,
  declKind: VariableDeclarationKind,
  registry: TypeRegistry
): IRStatement {
  const name = decl.getName();
  const typeNode = decl.getTypeNode();
  const type = typeNode ? mapTsTypeToIR(typeNode.getText(), false, registry) : primitiveType('f64');

  const init = decl.getInitializer();
  if (!init) {
    throw new Error(`Variable '${name}' must have an initializer`);
  }

  const mutable = declKind === VariableDeclarationKind.Let || 
                   type.kind === 'array' || 
                   type.kind === 'struct' || 
                   type.kind === 'enum';

  // Handle struct literal with type annotation
  let initExpr = parseExpression(init);
  if (initExpr.kind === 'struct_literal' && initExpr.structName === '__anonymous__' && typeNode) {
    initExpr = { ...initExpr, structName: typeNode.getText() };
  }

  return {
    kind: 'variable',
    name,
    type,
    mutable,
    init: initExpr,
  };
}

// ============================================================================
// Expression Statement
// ============================================================================

function parseExpressionStatement(exprStmt: ExpressionStatement): IRStatement {
  const expr = exprStmt.getExpression();

  // Check if this is an assignment
  if (expr.getKind() === SyntaxKind.BinaryExpression) {
    const binExpr = expr as BinaryExpression;
    const op = binExpr.getOperatorToken().getText();

    if (op === '=') {
      return {
        kind: 'assignment',
        target: parseExpression(binExpr.getLeft()),
        value: parseExpression(binExpr.getRight()),
      };
    }

    // Handle compound assignments
    if (['+=', '-=', '*=', '/=', '%='].includes(op)) {
      const target = parseExpression(binExpr.getLeft());
      const baseOp = op.slice(0, -1);
      return {
        kind: 'assignment',
        target,
        value: {
          kind: 'binary',
          operator: baseOp,
          left: target,
          right: parseExpression(binExpr.getRight()),
        },
      };
    }
  }

  // Check for increment/decrement
  if (expr.getKind() === SyntaxKind.PostfixUnaryExpression) {
    const postfix = expr.asKind(SyntaxKind.PostfixUnaryExpression)!;
    const operand = parseExpression(postfix.getOperand());
    const opToken = postfix.getOperatorToken();

    const increment = opToken === SyntaxKind.PlusPlusToken;
    const decrement = opToken === SyntaxKind.MinusMinusToken;

    if (increment || decrement) {
      return {
        kind: 'assignment',
        target: operand,
        value: {
          kind: 'binary',
          operator: increment ? '+' : '-',
          left: operand,
          right: { kind: 'literal', value: 1, type: primitiveType('i32'), isInteger: true },
        },
      };
    }
  }

  return {
    kind: 'expression',
    expression: parseExpression(expr),
  };
}

// ============================================================================
// Control Flow Statements
// ============================================================================

function parseIfStatement(ifStmt: IfStatement, registry: TypeRegistry): IRStatement {
  const condition = parseExpression(ifStmt.getExpression());

  const thenStmt = ifStmt.getThenStatement();
  const thenBranch: IRStatement[] =
    thenStmt.getKind() === SyntaxKind.Block
      ? parseBlock(thenStmt as Block, registry)
      : [parseStatement(thenStmt, registry)];

  const elseStmt = ifStmt.getElseStatement();
  let elseBranch: IRStatement[] | undefined;
  if (elseStmt) {
    elseBranch =
      elseStmt.getKind() === SyntaxKind.Block
        ? parseBlock(elseStmt as Block, registry)
        : [parseStatement(elseStmt, registry)];
  }

  return {
    kind: 'if',
    condition,
    thenBranch,
    elseBranch,
  };
}

function parseWhileStatement(whileStmt: WhileStatement, registry: TypeRegistry): IRStatement {
  const condition = parseExpression(whileStmt.getExpression());

  const bodyStmt = whileStmt.getStatement();
  const body: IRStatement[] =
    bodyStmt.getKind() === SyntaxKind.Block
      ? parseBlock(bodyStmt as Block, registry)
      : [parseStatement(bodyStmt, registry)];

  return { kind: 'while', condition, body };
}

function parseForStatement(forStmt: ForStatement, registry: TypeRegistry): IRStatement {
  const statements: IRStatement[] = [];

  // Initializer
  const init = forStmt.getInitializer();
  if (init) {
    if (init.getKind() === SyntaxKind.VariableDeclarationList) {
      const declList = init.asKind(SyntaxKind.VariableDeclarationList)!;
      for (const decl of declList.getDeclarations()) {
        statements.push(parseVariableDeclaration(decl, declList.getDeclarationKind(), registry));
      }
    } else {
      statements.push({
        kind: 'expression',
        expression: parseExpression(init as Expression),
      });
    }
  }

  // Condition
  const condition = forStmt.getCondition();
  const conditionExpr: IRExpression = condition
    ? parseExpression(condition)
    : { kind: 'literal', value: true, type: primitiveType('bool') };

  // Body
  const bodyStmt = forStmt.getStatement();
  const bodyStatements: IRStatement[] =
    bodyStmt.getKind() === SyntaxKind.Block
      ? parseBlock(bodyStmt as Block, registry)
      : [parseStatement(bodyStmt, registry)];

  // Incrementor
  const incrementor = forStmt.getIncrementor();
  if (incrementor) {
    bodyStatements.push(parseIncrementor(incrementor));
  }

  statements.push({ kind: 'while', condition: conditionExpr, body: bodyStatements });

  return { kind: 'block', statements };
}

function parseIncrementor(expr: Expression): IRStatement {
  if (expr.getKind() === SyntaxKind.PostfixUnaryExpression) {
    const postfix = expr.asKind(SyntaxKind.PostfixUnaryExpression)!;
    const operand = parseExpression(postfix.getOperand());
    const isIncrement = postfix.getOperatorToken() === SyntaxKind.PlusPlusToken;

    return {
      kind: 'assignment',
      target: operand,
      value: {
        kind: 'binary',
        operator: isIncrement ? '+' : '-',
        left: operand,
        right: { kind: 'literal', value: 1, type: primitiveType('i32'), isInteger: true },
      },
    };
  }

  if (expr.getKind() === SyntaxKind.PrefixUnaryExpression) {
    const prefix = expr.asKind(SyntaxKind.PrefixUnaryExpression)!;
    const operand = parseExpression(prefix.getOperand());
    const isIncrement = prefix.getOperatorToken() === SyntaxKind.PlusPlusToken;

    return {
      kind: 'assignment',
      target: operand,
      value: {
        kind: 'binary',
        operator: isIncrement ? '+' : '-',
        left: operand,
        right: { kind: 'literal', value: 1, type: primitiveType('i32'), isInteger: true },
      },
    };
  }

  return { kind: 'expression', expression: parseExpression(expr) };
}

function parseForOfStatement(forOfStmt: ForOfStatement, registry: TypeRegistry): IRStatement {
  const init = forOfStmt.getInitializer();
  let variableName = '';
  let mutable = false;

  if (init.getKind() === SyntaxKind.VariableDeclarationList) {
    const declList = init.asKind(SyntaxKind.VariableDeclarationList)!;
    const decl = declList.getDeclarations()[0];
    if (decl) {
      variableName = decl.getName();
      mutable = declList.getDeclarationKind() === VariableDeclarationKind.Let;
    }
  }

  const iterable = parseExpression(forOfStmt.getExpression());

  const bodyStmt = forOfStmt.getStatement();
  const body: IRStatement[] =
    bodyStmt.getKind() === SyntaxKind.Block
      ? parseBlock(bodyStmt as Block, registry)
      : [parseStatement(bodyStmt, registry)];

  return {
    kind: 'for_in',
    variable: variableName,
    mutable,
    iterable,
    body,
  };
}

function parseSwitchStatement(
  switchStmt: SwitchStatement,
  registry: TypeRegistry
): IRStatement {
  const discriminant = parseExpression(switchStmt.getExpression());
  const cases: IRSwitchCase[] = [];
  const caseBlock = switchStmt.getCaseBlock();
  const clauses = caseBlock.getClauses();

  for (const clause of clauses) {
    const statements = clause.getStatements().map((s) => parseStatement(s, registry));
    const hasBreak = statements.length > 0 && statements[statements.length - 1]?.kind === 'break';
    const bodyStatements = hasBreak ? statements.slice(0, -1) : statements;
    const fallthrough = !hasBreak && statements.length > 0;

    if (clause.getKind() === SyntaxKind.CaseClause) {
      const caseClause = clause as CaseClause;
      cases.push({
        value: parseExpression(caseClause.getExpression()),
        body: bodyStatements,
        fallthrough,
      });
    } else {
      cases.push({
        value: undefined,
        body: bodyStatements,
        fallthrough: false,
      });
    }
  }

  return { kind: 'switch', discriminant, cases };
}
