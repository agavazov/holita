import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'node:fs';
import * as ts from 'typescript';

function source(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(new URL(path, import.meta.url), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
}

/** Inspect contracts as source; application implementations never import across boundaries. */
describe('Fleet field-error code localization contract', () => {
  it('maps every declared reason through the actual admin generic or Fleet reason map', () => {
    const declaration = source('./validation.ts')
      .statements.filter(ts.isTypeAliasDeclaration)
      .find((node) => node.name.text === 'FieldErrorCode');
    if (!declaration || !ts.isUnionTypeNode(declaration.type)) {
      throw new Error('Fleet FieldErrorCode must remain an explicit literal union.');
    }
    const codes = declaration.type.types.flatMap((node) =>
      ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal) ? [node.literal.text] : [],
    );
    expect(codes).toHaveLength(declaration.type.types.length);
    const mapped = new Set<string>();
    for (const [path, generic] of [
      ['../../admin/src/app/ui/forms/field-errors.ts', true],
      ['../../admin/src/app/features/fleet/field-errors.ts', false],
    ] as const) {
      const visit = (node: ts.Node): void => {
        if (
          generic &&
          ts.isVariableDeclaration(node) &&
          ts.isIdentifier(node.name) &&
          node.name.text === 'reasons' &&
          node.initializer &&
          ts.isObjectLiteralExpression(node.initializer)
        ) {
          for (const property of node.initializer.properties) {
            if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
              mapped.add(property.name.text);
            }
          }
        }
        if (
          !generic &&
          ts.isCaseClause(node) &&
          ts.isStringLiteral(node.expression) &&
          /^[A-Z][A-Z0-9_]{0,63}$/.test(node.expression.text)
        ) {
          mapped.add(node.expression.text);
        }
        ts.forEachChild(node, visit);
      };
      visit(source(path));
    }
    expect(codes.filter((code) => !mapped.has(code))).toEqual([]);
  });
});
