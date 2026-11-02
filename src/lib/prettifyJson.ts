/**
 * JSON prettifying that only changes whitespace.
 *
 * JSON.stringify(JSON.parse(...)) turns every number into a float, so large
 * integers get rounded (12345678901234567890 → 12345678901234567000) and
 * literals like 1.10 or 1e3 are rewritten. It also drops comments and fails on
 * unquoted template expressions such as {{user}}. jsonc-parser's format
 * re-indents the text without parsing values, so none of that happens.
 *
 * Unquoted template expressions are swapped for placeholder strings before
 * formatting and put back afterwards, because the formatter would read their
 * braces as nested objects. Expressions inside strings and comments are left
 * alone: formatters never touch those.
 */

import { applyEdits, format, parse, ParseError } from "jsonc-parser";

type Placeholders = { placeholder: string; template: string }[];

const PLACEHOLDER_PREFIX = "__voiden_template_";

function uniquePrefix(text: string): string {
  let prefix = PLACEHOLDER_PREFIX;
  while (text.includes(prefix)) prefix = `_${prefix}`;
  return prefix;
}

/** Index just past the string or comment starting at `start`, or -1 if none starts there. */
function skipToken(text: string, start: number): number {
  const twoChars = text.slice(start, start + 2);
  if (text[start] === '"') {
    let index = start + 1;
    while (index < text.length && text[index] !== '"') index += text[index] === "\\" ? 2 : 1;
    return index + 1;
  }
  if (twoChars === "//") {
    const end = text.indexOf("\n", start);
    return end === -1 ? text.length : end;
  }
  if (twoChars === "/*") {
    const end = text.indexOf("*/", start + 2);
    return end === -1 ? text.length : end + 2;
  }
  return -1;
}

/** Replaces each unquoted {{...}} in `text` with a unique quoted placeholder. */
function protectTemplates(text: string): { text: string; placeholders: Placeholders } {
  const prefix = uniquePrefix(text);
  const placeholders: Placeholders = [];
  let output = "";
  let index = 0;
  while (index < text.length) {
    const tokenEnd = skipToken(text, index);
    if (tokenEnd !== -1) {
      output += text.slice(index, tokenEnd);
      index = tokenEnd;
      continue;
    }
    const templateEnd = text.startsWith("{{", index) ? text.indexOf("}}", index + 2) : -1;
    if (templateEnd !== -1) {
      const placeholder = `"${prefix}${placeholders.length}__"`;
      placeholders.push({ placeholder, template: text.slice(index, templateEnd + 2) });
      output += placeholder;
      index = templateEnd + 2;
      continue;
    }
    output += text[index];
    index++;
  }
  return { text: output, placeholders };
}

function restoreTemplates(text: string, placeholders: Placeholders): string {
  return placeholders.reduce(
    (restored, { placeholder, template }) => restored.replace(placeholder, () => template),
    text,
  );
}

/** Re-indents JSON/JSONC with 2 spaces, keeping numbers, comments and {{templates}} as written. */
export function prettifyJson(json: string): string {
  const { text, placeholders } = protectTemplates(json);
  const edits = format(text, undefined, { insertSpaces: true, tabSize: 2 });
  return restoreTemplates(applyEdits(text, edits), placeholders);
}

/** Prettifies `json` only if it is plain, valid JSON; anything else comes back unchanged. */
export function prettifyIfValidJson(json: string): string {
  const errors: ParseError[] = [];
  parse(json, errors, { disallowComments: true, allowTrailingComma: false });
  return errors.length ? json : prettifyJson(json);
}
