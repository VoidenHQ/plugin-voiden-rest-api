/**
 * Response Record Node
 *
 * Renders a persisted `response` block — a historical record of a request's
 * last real execution, written by the voiden-mcp-server MCP tools
 * (write_result) or the voiden-runner CLI. Read-only: this is a record of
 * what already happened, not something the editor builds a request from.
 */

import * as React from "react";
import { Node } from "@tiptap/core";
import { ReactNodeViewRenderer } from "@tiptap/react";

export interface ResponseRecordAttrs {
  uid: string;
  requestUid: string | null;
  capturedAt: string | null;
  success: boolean;
  status: number | null;
  statusText: string | null;
  durationMs: number | null;
  size: number | null;
  requestHeaders: Record<string, string> | null;
  requestBody: string | null;
  responseHeaders: Record<string, string> | null;
  body: string | null;
  truncated: boolean;
  error: string | null;
}

const formatTime = (ms: number | null): string => {
  if (ms === null || ms === undefined) return "";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
};

const formatSize = (bytes: number | null): string => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
};

const formatCapturedAt = (iso: string | null): string => {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
};

function prettyBody(body: string | null): string {
  if (!body) return "";
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

// Factory function to create the node with context components (matches the
// rest of this plugin's node-registration convention).
export const createResponseRecordNode = (NodeViewWrapper: any, CodeEditor: any) => {
  const ResponseRecordComponent = ({ node }: any) => {
    const {
      success,
      status,
      statusText,
      durationMs,
      size,
      capturedAt,
      requestHeaders,
      requestBody,
      responseHeaders,
      body,
      truncated,
      error,
    } = node.attrs as ResponseRecordAttrs;

    // Exactly one section visible at a time (a tab bar, not independent
    // accordions) — the previous design let Body and Request both be open
    // simultaneously, each mounting its own <CodeEditor>. Toggling ANY one
    // of the three open/closed booleans re-rendered this whole component,
    // which re-rendered every OTHER currently-mounted CodeEditor too — that
    // combination is what produced the glitch/flash on toggle. With a
    // single active tab, switching tabs unmounts the previous CodeEditor
    // and mounts the next one; there's never more than one on screen, and
    // never a "sibling section re-rendered another's editor" case at all.
    type Tab = "body" | "headers" | "request";
    const [activeTab, setActiveTab] = React.useState<Tab>("body");

    const isSuccess = !error && typeof status === "number" && status >= 200 && status < 300;
    const isClientOrServerError = typeof status === "number" && status >= 400;
    const dotColor = error || (!success && !status)
      ? "bg-red-500"
      : isSuccess
        ? "bg-green-500"
        : isClientOrServerError
          ? "bg-red-500"
          : "bg-yellow-500";

    const headerEntries = (headers: Record<string, string> | null) =>
      headers ? Object.entries(headers) : [];

    const TabBar = () => {
      const tabs: { id: Tab; label: string }[] = [
        { id: "body", label: "Body" },
        { id: "headers", label: "Response Headers" },
        { id: "request", label: "Request" },
      ];
      return (
        <div className="flex items-center border-t border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-semibold select-none border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? "text-text border-accent"
                  : "text-comment border-transparent hover:text-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      );
    };

    const HeaderList = ({ headers }: { headers: Record<string, string> | null }) => {
      const entries = headerEntries(headers);
      if (entries.length === 0) {
        return <div className="text-xs text-comment py-1">No headers</div>;
      }
      return (
        <div className="font-mono text-xs space-y-0.5 py-1">
          {entries.map(([k, v]) => (
            <div key={k} className="flex gap-2">
              <span className="text-comment">{k}:</span>
              <span className="break-all">{v}</span>
            </div>
          ))}
        </div>
      );
    };

    return (
      <NodeViewWrapper className="response-record-node" style={{ userSelect: "text" }} contentEditable={false}>
        <div className="my-2 border border-border rounded bg-bg overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 p-3">
            <div className={`size-3 rounded-full flex-none ${dotColor}`} />
            <div className="flex-1 flex items-center gap-3 font-mono text-sm flex-wrap">
              <span className="font-bold">Response recorded</span>
              {status !== null && status !== undefined && (
                <span className="font-bold">{status} {statusText}</span>
              )}
              {durationMs !== null && durationMs !== undefined && (
                <span className="text-comment">{formatTime(durationMs)}</span>
              )}
              {size !== null && size !== undefined && (
                <span className="text-comment">{formatSize(size)}</span>
              )}
              {capturedAt && (
                <span className="text-comment text-xs">{formatCapturedAt(capturedAt)}</span>
              )}
            </div>
          </div>

          {error && (
            <div className="px-3 pb-2 text-xs text-red-500 font-mono break-all">{error}</div>
          )}
          {truncated && (
            <div className="px-3 pb-2 text-xs text-comment">Body truncated when recorded.</div>
          )}

          <TabBar />

          <div className="px-3 py-2">
            {activeTab === "body" && (
              body ? (
                <div className="response-record-editor">
                  <CodeEditor readOnly lang="json" value={prettyBody(body)} showReplace={false} />
                </div>
              ) : (
                <div className="text-xs text-comment py-1">No response body</div>
              )
            )}

            {activeTab === "headers" && <HeaderList headers={responseHeaders} />}

            {activeTab === "request" && (
              <>
                <div className="text-xs font-semibold text-comment mb-1">Headers</div>
                <HeaderList headers={requestHeaders} />
                {requestBody && (
                  <>
                    <div className="text-xs font-semibold text-comment mt-2 mb-1">Body</div>
                    <div className="response-record-editor">
                      <CodeEditor readOnly lang="json" value={prettyBody(requestBody)} showReplace={false} />
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </NodeViewWrapper>
    );
  };

  return Node.create({
    name: "response",

    group: "block",

    atom: true,

    addAttributes() {
      return {
        uid: { default: null },
        requestUid: { default: null },
        capturedAt: { default: null },
        success: { default: false },
        status: { default: null },
        statusText: { default: null },
        durationMs: { default: null },
        size: { default: null },
        requestHeaders: { default: null },
        requestBody: { default: null },
        responseHeaders: { default: null },
        body: { default: null },
        truncated: { default: false },
        error: { default: null },
      };
    },

    parseHTML() {
      return [{ tag: 'div[data-type="response"]' }];
    },

    renderHTML({ HTMLAttributes }) {
      return ["div", { "data-type": "response", ...HTMLAttributes }];
    },

    addNodeView() {
      return ReactNodeViewRenderer(ResponseRecordComponent, {
        // This node has no ProseMirror content (atom, no contentDOM) — its body/headers
        // sections are plain React DOM. Without this, clicking inside them falls through
        // to ProseMirror's default click handling, which can't resolve a cursor position
        // inside an atom node and snaps the selection to the block before/after instead.
        stopEvent: () => true,
      });
    },
  });
};
