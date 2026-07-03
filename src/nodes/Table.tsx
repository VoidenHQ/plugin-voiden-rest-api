/* eslint-disable react/display-name */
import React from "react";
import { CellSelection } from "@tiptap/pm/tables";
import { Editor, mergeAttributes, Node, NodeViewProps } from "@tiptap/core";
import { NodeViewContent, NodeViewWrapper, ReactNodeViewRenderer } from "@tiptap/react";
import {
  HttpHeadersHelp,
  HttpQueryParamsHelp,
  HttpUrlFormHelp,
  HttpMultipartFormHelp,
  HttpPathParamsHelp,
  HttpCookiesHelp,
  RequestOptionsHelp,
} from "../help";

export function isCellSelection(value: unknown): value is CellSelection {
  return value instanceof CellSelection;
}

const TableWrapperNode = Node.create({
  name: "table-wrapper",
  group: "block",
  content: "table",
  parseHTML() {
    return [{ tag: "table-wrapper" }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "table-wrapper",
      mergeAttributes(HTMLAttributes, {
        class: "w-full overflow-auto",
      }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TableNodeView);
  },
});
// Adds a Description column (issue #261) to a table created before this feature
// shipped. Positions the selection in the last cell of the first row and runs
// the standard addColumnAfter table command, which pads every row uniformly.
const addDescriptionColumn = (editor: Editor, getPos: () => number, wrapperNode: NodeViewProps["node"]) => {
  const tableNode = wrapperNode.firstChild;
  const firstRow = tableNode?.firstChild;
  if (!tableNode || !firstRow || firstRow.childCount === 0) return;

  let pos = getPos() + 3; // doc position of the first row's first cell
  for (let i = 0; i < firstRow.childCount - 1; i++) {
    pos += firstRow.child(i).nodeSize;
  }
  editor.chain().focus(pos + 1).addColumnAfter().run();
};

// Static, non-editable column labels rendered above the actual ProseMirror table.
// A plain <table> with the same column count and table-fixed/w-full sizing as the
// real data table below it, so column widths line up exactly.
const ColumnLabels = ({ hasDescription }: { hasDescription: boolean }) => {
  const b = '1px solid var(--ui-line)';
  const thClass = "text-left text-[10px] uppercase tracking-wide font-medium py-1.5 px-3";
  const cell = (extra: React.CSSProperties = {}): React.CSSProperties => ({
    color: 'var(--fg-secondary, var(--editor-fg))',
    borderBottom: b,
    borderRight: b,
    ...extra,
  });
  return (
    <table className="w-full table-fixed" style={{ borderSpacing: 0, borderCollapse: 'separate' }} contentEditable={false}>
      <tbody>
        <tr>
          <th style={{ width: 28, minWidth: 28, maxWidth: 28, borderBottom: b, borderRight: b }} />
          <th className={thClass} style={cell()}>Key</th>
          <th className={thClass} style={cell(!hasDescription ? { borderRight: 'none' } : {})}>Value</th>
          {hasDescription && <th className={thClass} style={cell({ borderRight: 'none' })}>Description</th>}
        </tr>
      </tbody>
    </table>
  );
};

const createNodeView =
  (title: string, RequestBlockHeader: any, openFile?: (relativePath: string) => Promise<void>, helpContent?: React.ReactNode, supportsDescriptionColumn?: boolean) =>
  ({ editor, node, getPos }: NodeViewProps) => {
    const isEditable = !node?.attrs?.importedFrom || title === "Multipart Form";
    const columnCount = node.firstChild?.firstChild?.childCount ?? 0;
    const showAddDescription = supportsDescriptionColumn && isEditable && columnCount > 0 && columnCount < 3;

    return (
      <NodeViewWrapper
        spellCheck="false"
        className="my-3"
      >
        <div className="rounded-md border overflow-hidden" style={{ borderColor: 'var(--ui-line)' }}>
          <RequestBlockHeader
            title={title}
            editor={editor}
            importedDocumentId={node.attrs.importedFrom}
            openFile={openFile}
            helpContent={helpContent}
            actions={
              showAddDescription ? (
                <button
                  type="button"
                  onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
                  onClick={() => addDescriptionColumn(editor, getPos, node)}
                  className="text-[10px] text-comment hover:text-text transition-colors px-1.5 py-0.5 rounded hover:bg-active/50"
                >
                  + Description
                </button>
              ) : undefined
            }
          />
          {supportsDescriptionColumn && columnCount > 0 && <ColumnLabels hasDescription={columnCount >= 3} />}
          <div
            className="w-full max-w-full"
            contentEditable={editor.isEditable && isEditable}
            suppressContentEditableWarning
            style={{
              pointerEvents: !isEditable ? "none" : "unset",
              userSelect: isEditable ? "text" : "none",
            }}
          >
            <NodeViewContent />
          </div>
        </div>
      </NodeViewWrapper>
    );
  };

const TableNodeView = (props: { editor: Editor }) => {
  return (
    <NodeViewWrapper>
      <span className="pointer-none" tabIndex={-1} contentEditable={false}>
        Table
      </span>
      <NodeViewContent />
    </NodeViewWrapper>
  );
};

// Factory functions to create table nodes with openFile callback and RequestBlockHeader component
export const createHeadersTableNodeView = (RequestBlockHeader: any, openFile?: (relativePath: string) => Promise<void>) =>
  TableWrapperNode.extend({
    name: "headers-table",
    atom: true,
    addAttributes() {
      return {
        importedFrom: {
          default: "",
        },
      };
    },
    parseHTML() {
      return [{ tag: "headers-table" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["headers-table", mergeAttributes(HTMLAttributes), 0];
    },
    addNodeView() {
      return ReactNodeViewRenderer(createNodeView("HTTP-HEADERS", RequestBlockHeader, openFile, <HttpHeadersHelp />, true));
    },
  });

export const createQueryTableNodeView = (RequestBlockHeader: any, openFile?: (relativePath: string) => Promise<void>) =>
  TableWrapperNode.extend({
    name: "query-table",
    addAttributes() {
      return {
        importedFrom: {
          default: "",
        },
      };
    },
    parseHTML() {
      return [{ tag: "query-table" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["query-table", mergeAttributes(HTMLAttributes), 0];
    },
    addNodeView() {
      return ReactNodeViewRenderer(createNodeView("HTTP-QUERY-PARAMS", RequestBlockHeader, openFile, <HttpQueryParamsHelp />, true));
    },
  });

export const createURLTableNodeView = (RequestBlockHeader: any, openFile?: (relativePath: string) => Promise<void>) =>
  TableWrapperNode.extend({
    name: "url-table",
    addAttributes() {
      return {
        importedFrom: {
          default: "",
        },
      };
    },
    parseHTML() {
      return [{ tag: "url-table" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["url-table", mergeAttributes(HTMLAttributes), 0];
    },
    addNodeView() {
      return ReactNodeViewRenderer(createNodeView("HTTP-URL-FORM", RequestBlockHeader, openFile, <HttpUrlFormHelp />, true));
    },
  });

export const createMultipartTableNodeView = (RequestBlockHeader: any, openFile?: (relativePath: string) => Promise<void>) =>
  TableWrapperNode.extend({
    name: "multipart-table",
    addAttributes() {
      return {
        importedFrom: {
          default: "",
        },
      };
    },
    parseHTML() {
      return [{ tag: "multipart-table" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["multipart-table", mergeAttributes(HTMLAttributes), 0];
    },
    addNodeView() {
      return ReactNodeViewRenderer(createNodeView("HTTP-MULTIPART-FORM-DATA", RequestBlockHeader, openFile, <HttpMultipartFormHelp />, true));
    },
  });

export const createPathParamsTableNodeView = (RequestBlockHeader: any, openFile?: (relativePath: string) => Promise<void>) =>
  TableWrapperNode.extend({
    name: "path-table",
    addAttributes() {
      return {
        importedFrom: {
          default: "",
        },
      };
    },
    parseHTML() {
      return [{ tag: "path-table" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["path-table", mergeAttributes(HTMLAttributes), 0];
    },
    addNodeView() {
      return ReactNodeViewRenderer(createNodeView("HTTP-PATH-PARAMS", RequestBlockHeader, openFile, <HttpPathParamsHelp />, true));
    },
  });

export const createCookiesTableNodeView = (RequestBlockHeader: any, openFile?: (relativePath: string) => Promise<void>) =>
  TableWrapperNode.extend({
    name: "cookies-table",
    addAttributes() {
      return {
        importedFrom: {
          default: "",
        },
      };
    },
    parseHTML() {
      return [{ tag: "cookies-table" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["cookies-table", mergeAttributes(HTMLAttributes), 0];
    },
    addNodeView() {
      return ReactNodeViewRenderer(createNodeView("HTTP-COOKIES", RequestBlockHeader, openFile, <HttpCookiesHelp />));
    },
  });

export const createOptionsTableNodeView = (RequestBlockHeader: any, openFile?: (relativePath: string) => Promise<void>) =>
  TableWrapperNode.extend({
    name: "options-table",
    addAttributes() {
      return {
        importedFrom: {
          default: "",
        },
      };
    },
    parseHTML() {
      return [{ tag: "options-table" }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["options-table", mergeAttributes(HTMLAttributes), 0];
    },
    addNodeView() {
      return ReactNodeViewRenderer(createNodeView("REQUEST-OPTIONS", RequestBlockHeader, openFile, <RequestOptionsHelp />, true));
    },
  });

// Note: Backward compatibility exports removed
// All table nodes now require RequestBlockHeader component from context
// Use the factory functions (createHeadersTableNodeView, etc.) instead
