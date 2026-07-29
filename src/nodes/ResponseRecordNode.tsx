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

    const [bodyOpen, setBodyOpen] = React.useState(true);
    const [headersOpen, setHeadersOpen] = React.useState(false);
    const [requestOpen, setRequestOpen] = React.useState(false);

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

    const Section = ({
      title,
      open,
      onToggle,
      children,
    }: {
      title: string;
      open: boolean;
      onToggle: () => void;
      children: React.ReactNode;
    }) => (
      <div className="border-t border-border">
        <div
          className="flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-panel select-none"
          onClick={onToggle}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 12 12"
            fill="none"
            className="text-comment"
            style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "transform 0.15s" }}
          >
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="text-xs font-semibold text-comment">{title}</span>
        </div>
        {open && <div className="px-3 pb-2">{children}</div>}
      </div>
    );

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

          <Section title="Body" open={bodyOpen} onToggle={() => setBodyOpen(!bodyOpen)}>
            {body ? (
              <div className="response-record-editor">
                <CodeEditor readOnly lang="json" value={prettyBody(body)} showReplace={false} />
              </div>
            ) : (
              <div className="text-xs text-comment py-1">No response body</div>
            )}
          </Section>

          <Section title="Response Headers" open={headersOpen} onToggle={() => setHeadersOpen(!headersOpen)}>
            <HeaderList headers={responseHeaders} />
          </Section>

          <Section title="Request" open={requestOpen} onToggle={() => setRequestOpen(!requestOpen)}>
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
          </Section>
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
      return ReactNodeViewRenderer(ResponseRecordComponent);
    },
  });
};
