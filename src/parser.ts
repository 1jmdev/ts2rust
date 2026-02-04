// Parser: Convert TypeScript AST to IR

import {
  SourceFile,
  Node,
  SyntaxKind,
  FunctionDeclaration,
  VariableDeclaration,
  VariableDeclarationKind,
  Expression,
  Statement,
  Block,
  IfStatement,
  WhileStatement,
  ForStatement,
  ReturnStatement,
  ExpressionStatement,
  BinaryExpression,
  PrefixUnaryExpression,
  CallExpression,
  ElementAccessExpression,
  PropertyAccessExpression,
  Identifier,
  NumericLiteral,
  StringLiteral,
  ArrayLiteralExpression,
  SwitchStatement,
  CaseClause,
  DefaultClause,
} from 'ts-morph';

import {
  type IRProgram,
  type IRFunction,
  type IRParam,
  type IRStatement,
  type IRExpression,
  type IRType,
  type IRVariableDecl,
  type IRAssignment,
  type IRReturn,
  type IRIf,
  type IRWhile,
  type IRSwitch,
  type IRSwitchCase,
  type IRExpressionStmt,
  type IRLiteral,
  type IRIdentifier,
  type IRBinaryOp,
  type IRUnaryOp,
  type IRCall,
  type IRMethodCall,
  type IRIndex,
  type IRPropertyAccess,
  type IRArrayLiteral,
  primitiveType,
} from './ir.ts';

import { mapTsTypeToIR } from './types.ts';
import { isBuiltinNamespace } from './builtins.ts';

/**
 * Parse a TypeScript source file into our IR
 */
export function parse(sourceFile: SourceFile): IRProgram {
  const functions: IRFunction[] = [];

  for (const statement of sourceFile.getStatements()) {
    if (statement.getKind() === SyntaxKind.FunctionDeclaration) {
      functions.push(parseFunction(statement as FunctionDeclaration));
    }
  }

  return { functions };
}

function parseFunction(func: FunctionDeclaration): IRFunction {
  const name = func.getName() || 'anonymous';

  // Parse parameters
  const params: IRParam[] = func.getParameters().map((param) => ({
    name: param.getName(),
    type: mapTsTypeToIR(param.getTypeNode()!.getText()),
  }));

  // Parse return type - use forReturnType=true for owned types
  const returnTypeNode = func.getReturnTypeNode();
  const returnType = returnTypeNode
    ? mapTsTypeToIR(returnTypeNode.getText(), true)
    : primitiveType('void');

  // Parse body
  const body = func.getBody();
  const statements: IRStatement[] = body ? parseBlock(body as Block) : [];

  return { name, params, returnType, body: statements };
}

function parseBlock(block: Block): IRStatement[] {
  return block.getStatements().map(parseStatement);
}

function parseStatement(stmt: Statement): IRStatement {
  const kind = stmt.getKind();

  switch (kind) {
    case SyntaxKind.VariableStatement: {
      // Handle variable declarations
      const varStmt = stmt.asKind(SyntaxKind.VariableStatement)!;
      const declList = varStmt.getDeclarationList();
      const decls = declList.getDeclarations();

      // We only support single declarations for now
      if (decls.length !== 1) {
        throw new Error('Multiple variable declarations in one statement not supported');
      }

      const decl = decls[0]!;
      return parseVariableDeclaration(decl, declList.getDeclarationKind());
    }

    case SyntaxKind.ExpressionStatement: {
      const exprStmt = stmt as ExpressionStatement;
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
          } satisfies IRAssignment;
        }

        // Handle compound assignments like +=, -=, etc.
        if (['+=', '-=', '*=', '/='].includes(op)) {
          const target = parseExpression(binExpr.getLeft());
          const baseOp = op.slice(0, -1); // Remove the '='
          return {
            kind: 'assignment',
            target,
            value: {
              kind: 'binary',
              operator: baseOp,
              left: target,
              right: parseExpression(binExpr.getRight()),
            } satisfies IRBinaryOp,
          } satisfies IRAssignment;
        }
      }

      // Check for increment/decrement (i++)
      if (expr.getKind() === SyntaxKind.PostfixUnaryExpression) {
        const postfix = expr.asKind(SyntaxKind.PostfixUnaryExpression)!;
        const operand = parseExpression(postfix.getOperand());
        const opToken = postfix.getOperatorToken();

        if (opToken === SyntaxKind.PlusPlusToken) {
          return {
            kind: 'assignment',
            target: operand,
            value: {
              kind: 'binary',
              operator: '+',
              left: operand,
              right: { kind: 'literal', value: 1, type: primitiveType('i32'), isInteger: true } satisfies IRLiteral,
            } satisfies IRBinaryOp,
          } satisfies IRAssignment;
        }

        if (opToken === SyntaxKind.MinusMinusToken) {
          return {
            kind: 'assignment',
            target: operand,
            value: {
              kind: 'binary',
              operator: '-',
              left: operand,
              right: { kind: 'literal', value: 1, type: primitiveType('i32'), isInteger: true } satisfies IRLiteral,
            } satisfies IRBinaryOp,
          } satisfies IRAssignment;
        }
      }

      return {
        kind: 'expression',
        expression: parseExpression(expr),
      } satisfies IRExpressionStmt;
    }

    case SyntaxKind.ReturnStatement: {
      const retStmt = stmt as ReturnStatement;
      const expr = retStmt.getExpression();
      return {
        kind: 'return',
        value: expr ? parseExpression(expr) : undefined,
      } satisfies IRReturn;
    }

    case SyntaxKind.IfStatement: {
      const ifStmt = stmt as IfStatement;
      const condition = parseExpression(ifStmt.getExpression());

      const thenStmt = ifStmt.getThenStatement();
      const thenBranch: IRStatement[] =
        thenStmt.getKind() === SyntaxKind.Block
          ? parseBlock(thenStmt as Block)
          : [parseStatement(thenStmt)];

      const elseStmt = ifStmt.getElseStatement();
      let elseBranch: IRStatement[] | undefined;
      if (elseStmt) {
        elseBranch =
          elseStmt.getKind() === SyntaxKind.Block
            ? parseBlock(elseStmt as Block)
            : [parseStatement(elseStmt)];
      }

      return {
        kind: 'if',
        condition,
        thenBranch,
        elseBranch,
      } satisfies IRIf;
    }

    case SyntaxKind.WhileStatement: {
      const whileStmt = stmt as WhileStatement;
      const condition = parseExpression(whileStmt.getExpression());

      const bodyStmt = whileStmt.getStatement();
      const body: IRStatement[] =
        bodyStmt.getKind() === SyntaxKind.Block
          ? parseBlock(bodyStmt as Block)
          : [parseStatement(bodyStmt)];

      return {
        kind: 'while',
        condition,
        body,
      } satisfies IRWhile;
    }

    case SyntaxKind.ForStatement: {
      // Convert for loop to while loop
      const forStmt = stmt as ForStatement;
      const statements: IRStatement[] = [];

      // Initializer
      const init = forStmt.getInitializer();
      if (init) {
        if (init.getKind() === SyntaxKind.VariableDeclarationList) {
          const declList = init.asKind(SyntaxKind.VariableDeclarationList)!;
          for (const decl of declList.getDeclarations()) {
            statements.push(parseVariableDeclaration(decl, declList.getDeclarationKind()));
          }
        } else {
          // Expression initializer
          statements.push({
            kind: 'expression',
            expression: parseExpression(init as Expression),
          } satisfies IRExpressionStmt);
        }
      }

      // Condition
      const condition = forStmt.getCondition();
      const conditionExpr: IRExpression = condition
        ? parseExpression(condition)
        : ({ kind: 'literal', value: true, type: primitiveType('bool') } satisfies IRLiteral);

      // Body
      const bodyStmt = forStmt.getStatement();
      const bodyStatements: IRStatement[] =
        bodyStmt.getKind() === SyntaxKind.Block
          ? parseBlock(bodyStmt as Block)
          : [parseStatement(bodyStmt)];

      // Incrementor (add at end of body)
      const incrementor = forStmt.getIncrementor();
      if (incrementor) {
        // Handle i++ style incrementors
        if (incrementor.getKind() === SyntaxKind.PostfixUnaryExpression) {
          const postfix = incrementor.asKind(SyntaxKind.PostfixUnaryExpression)!;
          const operand = parseExpression(postfix.getOperand());
          const opToken = postfix.getOperatorToken();

          if (opToken === SyntaxKind.PlusPlusToken) {
            bodyStatements.push({
              kind: 'assignment',
              target: operand,
              value: {
                kind: 'binary',
                operator: '+',
                left: operand,
                right: { kind: 'literal', value: 1, type: primitiveType('i32'), isInteger: true } satisfies IRLiteral,
              } satisfies IRBinaryOp,
            } satisfies IRAssignment);
          } else if (opToken === SyntaxKind.MinusMinusToken) {
            bodyStatements.push({
              kind: 'assignment',
              target: operand,
              value: {
                kind: 'binary',
                operator: '-',
                left: operand,
                right: { kind: 'literal', value: 1, type: primitiveType('i32'), isInteger: true } satisfies IRLiteral,
              } satisfies IRBinaryOp,
            } satisfies IRAssignment);
          }
        } else if (incrementor.getKind() === SyntaxKind.PrefixUnaryExpression) {
          const prefix = incrementor.asKind(SyntaxKind.PrefixUnaryExpression)!;
          const operand = parseExpression(prefix.getOperand());
          const opText = prefix.getOperatorToken();

          if (opText === SyntaxKind.PlusPlusToken) {
            bodyStatements.push({
              kind: 'assignment',
              target: operand,
              value: {
                kind: 'binary',
                operator: '+',
                left: operand,
                right: { kind: 'literal', value: 1, type: primitiveType('i32'), isInteger: true } satisfies IRLiteral,
              } satisfies IRBinaryOp,
            } satisfies IRAssignment);
          } else if (opText === SyntaxKind.MinusMinusToken) {
            bodyStatements.push({
              kind: 'assignment',
              target: operand,
              value: {
                kind: 'binary',
                operator: '-',
                left: operand,
                right: { kind: 'literal', value: 1, type: primitiveType('i32'), isInteger: true } satisfies IRLiteral,
              } satisfies IRBinaryOp,
            } satisfies IRAssignment);
          }
        } else {
          // Generic expression incrementor
          bodyStatements.push({
            kind: 'expression',
            expression: parseExpression(incrementor),
          } satisfies IRExpressionStmt);
        }
      }

      // Create while loop
      statements.push({
        kind: 'while',
        condition: conditionExpr,
        body: bodyStatements,
      } satisfies IRWhile);

      // Return a block containing init + while
      return {
        kind: 'block',
        statements,
      };
    }

    case SyntaxKind.SwitchStatement: {
      const switchStmt = stmt as SwitchStatement;
      const discriminant = parseExpression(switchStmt.getExpression());

      const cases: IRSwitchCase[] = [];
      const caseBlock = switchStmt.getCaseBlock();
      const clauses = caseBlock.getClauses();

      for (let i = 0; i < clauses.length; i++) {
        const clause = clauses[i]!;
        const statements = clause.getStatements().map(parseStatement);

        // Check if this case has a break as the last statement
        const hasBreak = statements.length > 0 && statements[statements.length - 1]?.kind === 'break';
        
        // Remove the break from the statements (Rust match doesn't need explicit break)
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
          // Default clause
          cases.push({
            value: undefined, // undefined means default
            body: bodyStatements,
            fallthrough: false,
          });
        }
      }

      return {
        kind: 'switch',
        discriminant,
        cases,
      } satisfies IRSwitch;
    }

    case SyntaxKind.BreakStatement: {
      return { kind: 'break' };
    }

    case SyntaxKind.Block: {
      return {
        kind: 'block',
        statements: parseBlock(stmt as Block),
      };
    }

    default:
      throw new Error(`Unsupported statement kind: ${stmt.getKindName()}`);
  }
}

function parseVariableDeclaration(
  decl: VariableDeclaration,
  declKind: VariableDeclarationKind
): IRVariableDecl {
  const name = decl.getName();
  const typeNode = decl.getTypeNode();
  const type = typeNode ? mapTsTypeToIR(typeNode.getText()) : primitiveType('f64');

  const init = decl.getInitializer();
  if (!init) {
    throw new Error(`Variable '${name}' must have an initializer`);
  }

  // 'let' is mutable, 'const' is immutable
  const mutable = declKind === VariableDeclarationKind.Let;

  return {
    kind: 'variable',
    name,
    type,
    mutable,
    init: parseExpression(init),
  };
}

function parseExpression(expr: Expression): IRExpression {
  const kind = expr.getKind();

  switch (kind) {
    case SyntaxKind.NumericLiteral: {
      const num = expr as NumericLiteral;
      const value = num.getLiteralValue();
      const isInteger = Number.isInteger(value);
      return {
        kind: 'literal',
        value: value,
        type: primitiveType(isInteger ? 'i32' : 'f64'),
        isInteger,
      } satisfies IRLiteral;
    }

    case SyntaxKind.StringLiteral: {
      const str = expr as StringLiteral;
      return {
        kind: 'literal',
        value: str.getLiteralValue(),
        type: primitiveType('&str'),  // String literals are &str
      } satisfies IRLiteral;
    }

    case SyntaxKind.TrueKeyword: {
      return {
        kind: 'literal',
        value: true,
        type: primitiveType('bool'),
      } satisfies IRLiteral;
    }

    case SyntaxKind.FalseKeyword: {
      return {
        kind: 'literal',
        value: false,
        type: primitiveType('bool'),
      } satisfies IRLiteral;
    }

    case SyntaxKind.Identifier: {
      const ident = expr as Identifier;
      return {
        kind: 'identifier',
        name: ident.getText(),
      } satisfies IRIdentifier;
    }

    case SyntaxKind.BinaryExpression: {
      const binExpr = expr as BinaryExpression;
      const operator = binExpr.getOperatorToken().getText();

      // Map TypeScript operators to Rust equivalents
      const opMap: Record<string, string> = {
        '===': '==',
        '!==': '!=',
        '&&': '&&',
        '||': '||',
      };

      return {
        kind: 'binary',
        operator: opMap[operator] || operator,
        left: parseExpression(binExpr.getLeft()),
        right: parseExpression(binExpr.getRight()),
      } satisfies IRBinaryOp;
    }

    case SyntaxKind.PrefixUnaryExpression: {
      const prefixExpr = expr as PrefixUnaryExpression;
      const opToken = prefixExpr.getOperatorToken();
      let operator: string;

      switch (opToken) {
        case SyntaxKind.ExclamationToken:
          operator = '!';
          break;
        case SyntaxKind.MinusToken:
          operator = '-';
          break;
        case SyntaxKind.PlusToken:
          operator = '+';
          break;
        default:
          throw new Error(`Unsupported prefix operator: ${opToken}`);
      }

      return {
        kind: 'unary',
        operator,
        operand: parseExpression(prefixExpr.getOperand()),
      } satisfies IRUnaryOp;
    }

    case SyntaxKind.CallExpression: {
      const callExpr = expr as CallExpression;
      const calleeExpr = callExpr.getExpression();
      const args = callExpr.getArguments().map((a) => parseExpression(a as Expression));

      // Check for property access (method call or namespace call like console.log, Math.abs)
      if (calleeExpr.getKind() === SyntaxKind.PropertyAccessExpression) {
        const propAccess = calleeExpr as PropertyAccessExpression;
        const objExpr = propAccess.getExpression();
        const method = propAccess.getName();
        const objText = objExpr.getText();

        // Check if this is a builtin namespace (console, Math, etc.)
        if (isBuiltinNamespace(objText)) {
          return {
            kind: 'method_call',
            object: { kind: 'identifier', name: objText } satisfies IRIdentifier,
            method,
            args,
            namespace: objText,
          } satisfies IRMethodCall;
        }

        // Regular method call on an object
        return {
          kind: 'method_call',
          object: parseExpression(objExpr),
          method,
          args,
        } satisfies IRMethodCall;
      }

      // Regular function call
      return {
        kind: 'call',
        callee: calleeExpr.getText(),
        args,
      } satisfies IRCall;
    }

    case SyntaxKind.ElementAccessExpression: {
      const elemAccess = expr as ElementAccessExpression;
      return {
        kind: 'index',
        object: parseExpression(elemAccess.getExpression()),
        index: parseExpression(elemAccess.getArgumentExpression()!),
      } satisfies IRIndex;
    }

    case SyntaxKind.PropertyAccessExpression: {
      const propAccess = expr as PropertyAccessExpression;
      return {
        kind: 'property',
        object: parseExpression(propAccess.getExpression()),
        property: propAccess.getName(),
      } satisfies IRPropertyAccess;
    }

    case SyntaxKind.ArrayLiteralExpression: {
      const arrayLit = expr as ArrayLiteralExpression;
      const elements = arrayLit.getElements().map((e) => parseExpression(e as Expression));

      // Infer element type from first element, or default to f64
      let elementType: IRType = primitiveType('f64');
      if (elements.length > 0) {
        const firstElem = elements[0]!;
        if (firstElem.kind === 'literal') {
          elementType = firstElem.type;
        }
      }

      return {
        kind: 'array_literal',
        elements,
        elementType,
      } satisfies IRArrayLiteral;
    }

    case SyntaxKind.ParenthesizedExpression: {
      const parenExpr = expr.asKind(SyntaxKind.ParenthesizedExpression)!;
      return parseExpression(parenExpr.getExpression());
    }

    default:
      throw new Error(`Unsupported expression kind: ${expr.getKindName()}`);
  }
}
