// Local oxlint rules, loaded through `jsPlugins` in the root .oxlintrc.json.

interface Position {
  line: number;
  column: number;
}
interface Comment {
  type: "Line" | "Block";
  value: string;
  range: [number, number];
  loc: { start: Position; end: Position };
}
interface AstNode {
  type: string;
  loc: { start: Position; end: Position };
  declaration?: AstNode | null;
  declarations?: { init?: AstNode | null }[];
}
interface Fixer {
  replaceTextRange: (range: [number, number], text: string) => unknown;
}
interface Context {
  sourceCode: { lines: string[]; getCommentsBefore: (node: AstNode) => Comment[] };
  report: (descriptor: {
    loc: { start: Position; end: Position };
    messageId: string;
    fix: ((fixer: Fixer) => unknown) | null;
  }) => void;
}

const DIRECTIVE = /^\s*(?:oxlint-|eslint-|@ts-|custom:|prettier-ignore|oxfmt-ignore)/u;

function isFunctionInit(node?: AstNode | null): boolean {
  return node?.type === "ArrowFunctionExpression" || node?.type === "FunctionExpression";
}

function declaresFunction(statement: AstNode): boolean {
  const node =
    statement.type === "ExportNamedDeclaration" || statement.type === "ExportDefaultDeclaration"
      ? statement.declaration
      : statement;
  if (!node) {
    return false;
  }
  if (node.type === "FunctionDeclaration" || node.type === "TSDeclareFunction") {
    return true;
  }
  return (
    node.type === "VariableDeclaration" &&
    (node.declarations ?? []).some((declarator) => isFunctionInit(declarator.init))
  );
}

const plugin = {
  meta: { name: "openrift" },
  rules: {
    "function-comment-jsdoc": {
      meta: {
        type: "suggestion",
        fixable: "code",
        messages: {
          jsdoc:
            "A comment on a function declaration is a /** */ JSDoc block. If it fails the bar in docs/contributing.md (Comments), delete it.",
        },
      },
      create(context: Context) {
        const { sourceCode } = context;
        function check(statements: AstNode[]) {
          for (const statement of statements) {
            if (!declaresFunction(statement)) {
              continue;
            }
            const comments = sourceCode.getCommentsBefore(statement);
            let expectedEndLine = statement.loc.start.line - 1;
            let index = comments.length - 1;
            while (
              index >= 0 &&
              comments[index].type === "Line" &&
              comments[index].loc.end.line === expectedEndLine &&
              DIRECTIVE.test(comments[index].value)
            ) {
              expectedEndLine -= 1;
              index -= 1;
            }
            const run: Comment[] = [];
            while (
              index >= 0 &&
              comments[index].type === "Line" &&
              comments[index].loc.end.line === expectedEndLine &&
              !DIRECTIVE.test(comments[index].value) &&
              sourceCode.lines[expectedEndLine - 1].trimStart().startsWith("//")
            ) {
              run.unshift(comments[index]);
              expectedEndLine -= 1;
              index -= 1;
            }
            const [first] = run;
            const last = run.at(-1);
            if (!first || !last) {
              continue;
            }
            const indent = " ".repeat(first.loc.start.column);
            const texts = run.map((comment) => comment.value.replace(/^ /u, "").trimEnd());
            context.report({
              loc: { start: first.loc.start, end: last.loc.end },
              messageId: "jsdoc",
              fix: texts.some((text) => text.includes("*/"))
                ? null
                : (fixer: Fixer) =>
                    fixer.replaceTextRange(
                      [first.range[0], last.range[1]],
                      texts.length === 1
                        ? `/** ${texts[0]} */`
                        : `/**\n${texts.map((text) => `${indent} *${text ? ` ${text}` : ""}`).join("\n")}\n${indent} */`,
                    ),
            });
          }
        }
        return {
          Program: (node: { body: AstNode[] }) => check(node.body),
          BlockStatement: (node: { body: AstNode[] }) => check(node.body),
          SwitchCase: (node: { consequent: AstNode[] }) => check(node.consequent),
        };
      },
    },
  },
};

export default plugin;
