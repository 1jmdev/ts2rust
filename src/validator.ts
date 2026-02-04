// Validator: Check that TypeScript source conforms to our supported subset

import {
  SourceFile,
  Node,
  SyntaxKind,
  FunctionDeclaration,
  VariableDeclaration,
  TypeNode,
  ts,
} from 'ts-morph';

export interface ValidationError {
  message: string;
  line: number;
  column: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate that a source file conforms to the supported TypeScript subset
 */
export function validate(sourceFile: SourceFile): ValidationResult {
  const errors: ValidationError[] = [];

  function addError(node: Node, message: string): void {
    const { line, column } = sourceFile.getLineAndColumnAtPos(node.getStart());
    errors.push({ message, line, column });
  }

  function checkTypeNode(typeNode: TypeNode | undefined, context: string): void {
    if (!typeNode) {
      return;
    }

    const typeText = typeNode.getText();

    // Ban 'any'
    if (typeNode.getKind() === SyntaxKind.AnyKeyword || typeText === 'any') {
      addError(typeNode, `Type 'any' is not allowed in ${context}`);
    }

    // Ban 'unknown'
    if (typeNode.getKind() === SyntaxKind.UnknownKeyword || typeText === 'unknown') {
      addError(typeNode, `Type 'unknown' is not allowed in ${context}`);
    }

    // Ban 'null'
    if (typeNode.getKind() === SyntaxKind.NullKeyword || typeText === 'null') {
      addError(typeNode, `Type 'null' is not allowed in ${context}`);
    }

    // Ban 'undefined'
    if (typeNode.getKind() === SyntaxKind.UndefinedKeyword || typeText === 'undefined') {
      addError(typeNode, `Type 'undefined' is not allowed in ${context}`);
    }

    // Ban union types with null/undefined
    if (typeNode.getKind() === SyntaxKind.UnionType) {
      const unionTypes = typeNode.asKind(SyntaxKind.UnionType)?.getTypeNodes() || [];
      for (const ut of unionTypes) {
        checkTypeNode(ut, context);
      }
    }
  }

  function walkNode(node: Node): void {
    const kind = node.getKind();

    // Ban class declarations
    if (kind === SyntaxKind.ClassDeclaration) {
      addError(node, 'Class declarations are not supported');
    }

    // Ban async functions
    if (kind === SyntaxKind.FunctionDeclaration) {
      const func = node as FunctionDeclaration;
      if (func.isAsync()) {
        addError(node, 'Async functions are not supported');
      }

      // Check return type is specified
      const returnType = func.getReturnTypeNode();
      if (!returnType) {
        addError(node, `Function '${func.getName() || 'anonymous'}' must have an explicit return type`);
      } else {
        checkTypeNode(returnType, `function '${func.getName() || 'anonymous'}' return type`);
      }

      // Check all parameters have types
      for (const param of func.getParameters()) {
        const paramType = param.getTypeNode();
        if (!paramType) {
          addError(param, `Parameter '${param.getName()}' must have an explicit type annotation`);
        } else {
          checkTypeNode(paramType, `parameter '${param.getName()}'`);
        }
      }
    }

    // Ban arrow functions that are async
    if (kind === SyntaxKind.ArrowFunction) {
      const arrow = node.asKind(SyntaxKind.ArrowFunction);
      if (arrow?.isAsync()) {
        addError(node, 'Async arrow functions are not supported');
      }
    }

    // Ban await expressions
    if (kind === SyntaxKind.AwaitExpression) {
      addError(node, 'Await expressions are not supported');
    }

    // Ban try/catch/finally
    if (kind === SyntaxKind.TryStatement) {
      addError(node, 'Try/catch statements are not supported');
    }

    // Ban throw statements
    if (kind === SyntaxKind.ThrowStatement) {
      addError(node, 'Throw statements are not supported');
    }

    // Ban interface declarations (phase 2)
    if (kind === SyntaxKind.InterfaceDeclaration) {
      addError(node, 'Interface declarations are not supported in MVP');
    }

    // Ban type alias declarations (phase 2)
    if (kind === SyntaxKind.TypeAliasDeclaration) {
      addError(node, 'Type alias declarations are not supported in MVP');
    }

    // Ban enum declarations
    if (kind === SyntaxKind.EnumDeclaration) {
      addError(node, 'Enum declarations are not supported');
    }

    // Check variable declarations have explicit types
    if (kind === SyntaxKind.VariableDeclaration) {
      const varDecl = node as VariableDeclaration;
      const typeNode = varDecl.getTypeNode();
      if (!typeNode) {
        addError(node, `Variable '${varDecl.getName()}' must have an explicit type annotation`);
      } else {
        checkTypeNode(typeNode, `variable '${varDecl.getName()}'`);
      }
    }

    // Recursively check children
    node.forEachChild(walkNode);
  }

  // Walk all statements in the source file
  for (const statement of sourceFile.getStatements()) {
    walkNode(statement);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Format validation errors for display
 */
export function formatErrors(errors: ValidationError[], filename: string): string {
  return errors
    .map((e) => `${filename}:${e.line}:${e.column}: error: ${e.message}`)
    .join('\n');
}
