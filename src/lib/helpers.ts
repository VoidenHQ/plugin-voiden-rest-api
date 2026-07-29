/**
 * Voiden REST API Helpers
 *
 * Public API for other plugins/extensions to create REST API blocks programmatically.
 * This allows plugins like postman-import to generate Voiden REST API structures.
 */

import { JSONContent, generateJSON } from "@tiptap/core";
import YAML from "yaml";
import {
  convertToMethodNode,
  convertToURLNode,
  convertToHeadersTableNode,
  convertToQueryTableNode,
  convertToPathTableNode,
  convertToMultipartTableNode,
  convertToUrlTableNode,
  convertToCookiesTableNode,
  convertToJsonNode,
  convertToXMLNode,
  insertParagraphAfterRequestBlocks,
} from "./converter";

/**
 * Helper interface that will be exposed to other plugins
 */
export interface VoidenRestApiHelpers {
  // Node creators
  createMethodNode: (method: string) => JSONContent;
  createUrlNode: (url: string) => JSONContent;
  createHeadersTableNode: (headers: Array<[string, string] | [string, string, string]>) => JSONContent;
  createQueryTableNode: (params: Array<[string, string] | [string, string, string]>) => JSONContent;
  createPathParamsTableNode: (params: Array<[string, string] | [string, string, string]>) => JSONContent;
  createMultipartTableNode: (formData: [string, string][]) => JSONContent;
  createUrlTableNode: (formData: [string, string][]) => JSONContent;
  createCookiesTableNode: (cookies: [string, string][]) => JSONContent;
  createJsonBodyNode: (body: string, contentType: string) => JSONContent;
  createXMLBodyNode: (body: string, contentType: string) => JSONContent;

  // Content utilities
  convertToVoidMarkdown: (jsonContent: JSONContent) => Promise<string>;
  convertBlocksToVoidFile: (title: string, blocks: JSONContent[]) => string;
  insertParagraphAfterRequestBlocks: (content: JSONContent[]) => JSONContent[];
}

/**
 * Create HTTP method node
 */
export function createMethodNode(method: string): JSONContent {
  return convertToMethodNode(method);
}

/**
 * Create URL node
 */
export function createUrlNode(url: string): JSONContent {
  return convertToURLNode(url);
}

/**
 * Create headers table node
 */
export function createHeadersTableNode(headers: Array<[string, string] | [string, string, string]>): JSONContent {
  return convertToHeadersTableNode(headers);
}

/**
 * Create query parameters table node
 */
export function createQueryTableNode(params: Array<[string, string] | [string, string, string]>): JSONContent {
  return convertToQueryTableNode(params);
}

/**
 * Create path parameters table node
 */
export function createPathParamsTableNode(params: Array<[string, string] | [string, string, string]>): JSONContent {
  return convertToPathTableNode(params);
}

/**
 * Create multipart form data table node
 */
export function createMultipartTableNode(formData: [string, string][]): JSONContent {
  return convertToMultipartTableNode(formData);
}

/**
 * Create URL-encoded form data table node (application/x-www-form-urlencoded)
 */
export function createUrlTableNode(formData: [string, string][]): JSONContent {
  return convertToUrlTableNode(formData);
}

/**
 * Create cookies table node
 */
export function createCookiesTableNode(cookies: [string, string][]): JSONContent {
  return convertToCookiesTableNode(cookies);
}

/**
 * Create JSON body node
 */
export function createJsonBodyNode(body: string, contentType: string = "json"): JSONContent {
  return convertToJsonNode(body, contentType);
}

/**
 * Create XML body node
 */
export function createXMLBodyNode(body: string, contentType: string = "xml"): JSONContent {
  return convertToXMLNode(body, contentType);
}

/**
 * Convert JSON content to Voiden markdown format
 * This function converts a ProseMirror JSONContent structure to markdown
 * suitable for saving as a .void file
 */
export async function convertToVoidMarkdown(jsonContent: JSONContent): Promise<string> {
  // Get the markdown converter function that was set up by the plugin
  const converter = (window as any).__voidenMarkdownConverter__;

  if (!converter) {
    throw new Error(
      'Markdown converter not available. Make sure voiden-rest-api plugin is loaded first.'
    );
  }

  // Convert the JSONContent to markdown with frontmatter
  return await converter(jsonContent);
}


/**
 * Generate a UUID v4
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Extract text content from a JSONContent node
 * Recursively extracts text from the content array
 */
function extractTextContent(node: JSONContent): string {
  if (!node) return '';

  // If the node has a text property, return it
  if ('text' in node && typeof node.text === 'string') {
    return node.text;
  }

  // If the node has content, recursively extract text from children
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(child => extractTextContent(child)).join('');
  }

  return '';
}

/**
 * Ensure all blocks have UIDs
 */
function ensureUIDs(block: JSONContent): JSONContent {
  const result = { ...block };

  // Add UID if not present
  if (!result.attrs) {
    result.attrs = {};
  }
  if (!result.attrs.uid) {
    result.attrs.uid = generateUUID();
  }

  // Recursively add UIDs to content
  if (result.content && Array.isArray(result.content)) {
    result.content = result.content.map(item =>
      typeof item === 'object' && item.type ? ensureUIDs(item) : item
    );
  }

  return result;
}

/**
 * Simplify a ProseMirror table node into the minimal { type: "table", rows: [...] }
 * shape the desktop app's own save path writes. Mirrors apps/ui's
 * markdownConverter.ts simplifyTableNode() so blocks built here match
 * hand-saved ones byte-for-byte.
 */
function simplifyTableNode(tableJson: any): any {
  const simplified: { type: string; rows: any[] } = { type: "table", rows: [] };
  if (!tableJson.content || !Array.isArray(tableJson.content)) return simplified;

  tableJson.content.forEach((rowNode: any) => {
    if (rowNode.type !== "tableRow") return;
    const simpleRow: any = {};

    if (rowNode.attrs && Object.keys(rowNode.attrs).length > 0) {
      simpleRow.attrs = rowNode.attrs;
    }

    simpleRow.row = [];
    if (rowNode.content && Array.isArray(rowNode.content)) {
      rowNode.content.forEach((cellNode: any) => {
        if (cellNode.type !== "tableCell" && cellNode.type !== "tableHeader") return;

        let cellValue: any;
        if (cellNode.content && cellNode.content.length === 1 && cellNode.content[0].type === "paragraph") {
          const para = cellNode.content[0];
          if (para.content && para.content.length === 1 && para.content[0].type === "text") {
            cellValue = para.content[0].text;
          } else {
            cellValue = para.content?.map((child: any) => (child.type === "text" ? child.text : child));
            if (cellValue?.length === 1 && typeof cellValue[0] === "string") {
              cellValue = cellValue[0];
            }
          }
        } else {
          cellValue = cellNode.textContent || "";
        }
        simpleRow.row.push(cellValue);
      });
    }
    simplified.rows.push(simpleRow);
  });
  return simplified;
}

/**
 * Recursively collapse a node's `content` array into a plain string when it's
 * a single text node. Mirrors apps/ui's markdownConverter.ts collapseTextContent().
 */
function collapseTextContent(node: any): any {
  if (!node || typeof node !== "object") return node;

  if (Array.isArray(node.content)) {
    if (node.content.length === 1 && node.content[0].type === "text" && typeof node.content[0].text === "string") {
      node.content = node.content[0].text;
    } else {
      node.content = node.content.map((child: any) => collapseTextContent(child));
    }
  }
  return node;
}

/**
 * Bring a block into the same simplified shape the desktop app writes when a
 * file is saved from the editor (collapsed text content, flattened table
 * rows) instead of the raw ProseMirror node shape these builder functions
 * produce (paragraph > text, table > tableRow > tableCell > paragraph > text).
 * The desktop editor can inflate the raw shape at display time, but the
 * headless runner used by voiden-runner only knows how to read the
 * simplified shape — without this, freshly imported files fail to build a
 * request until the user opens and re-saves them in the app.
 */
function simplifyBlock(block: any): any {
  let nodeJson = { ...block };
  if (nodeJson.content && Array.isArray(nodeJson.content)) {
    nodeJson.content = nodeJson.content.map((child: any) =>
      child?.type === "table" ? simplifyTableNode(child) : collapseTextContent(child)
    );
  }
  nodeJson = collapseTextContent(nodeJson);
  return nodeJson;
}

/**
 * Convert JSONContent blocks to a complete .void file format
 * This generates markdown with YAML frontmatter and voiden blocks
 *
 * @param title - Document title
 * @param blocks - Array of JSONContent blocks (request, headers-table, etc.)
 * @returns Complete .void file content as string
 */
export function convertBlocksToVoidFile(title: string, blocks: JSONContent[]): string {
  const now = new Date().toISOString();
  let voidContent = '';

  // YAML frontmatter
  voidContent += '---\n';
  voidContent += 'version: 0.20.1\n';
  voidContent += 'generatedBy: Voiden Extension\n';
  voidContent += 'note: This file is auto-generated\n';
  voidContent += `generatedAt: ${now}\n`;
  voidContent += '---\n\n';

  // Title
  voidContent += `# ${title}\n\n`;

  // Add each block as a void, json or text code
  blocks.forEach(block => {
    if ( block.type == 'inline-json' ) {
      voidContent += '```json\n';
      // Extract text content from the block's content array
      const textContent = extractTextContent(block);
      voidContent += textContent;
      voidContent += '\n```\n\n';
    } else if ( block.type == 'paragraph' ) {
      voidContent += '\n';
      // Extract text content from the block's content array
      const textContent = extractTextContent(block);
      voidContent += textContent;
      voidContent += '\n';
    } else {
      // Ensure all blocks have UIDs, then simplify to the runner-compatible shape
      const blockWithUID = ensureUIDs(block);
      const simplifiedBlock = simplifyBlock(blockWithUID);

      voidContent += '```void\n';
      voidContent += '---\n';
      voidContent += YAML.stringify(simplifiedBlock, {
        lineWidth: 0,
        defaultKeyType: 'PLAIN',
      });
      voidContent += '---\n';
      voidContent += '```\n\n';
    }
  });

  return voidContent;
}

/**
 * Insert paragraph nodes after request blocks for better formatting
 */
export function insertParagraphAfterRequestBlocksHelper(content: JSONContent[]): JSONContent[] {
  return insertParagraphAfterRequestBlocks(content);
}

/**
 * Export all helpers as a single object
 * This is what will be exposed through window.__voidenHelpers__
 */
export const helpers: VoidenRestApiHelpers = {
  createMethodNode,
  createUrlNode,
  createHeadersTableNode,
  createQueryTableNode,
  createPathParamsTableNode,
  createMultipartTableNode,
  createUrlTableNode,
  createCookiesTableNode,
  createJsonBodyNode,
  createXMLBodyNode,
  convertToVoidMarkdown,
  convertBlocksToVoidFile,
  insertParagraphAfterRequestBlocks: insertParagraphAfterRequestBlocksHelper,
};
