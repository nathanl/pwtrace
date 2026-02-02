const AdmZip = require("adm-zip");
const { parseTrace } = require("./parser");
const fs = require("fs");
const path = require("path");

let MAX_TOTAL_ENTRIES = parseInt(process.env.PWTRACE_MAX_ENTRIES || "5000", 10);
let MAX_ENTRY_SIZE = parseInt(
  process.env.PWTRACE_MAX_ENTRY_SIZE || "10485760",
  10,
); // 10MB
let MAX_TOTAL_UNCOMPRESSED = parseInt(
  process.env.PWTRACE_MAX_TOTAL_UNCOMPRESSED || "524288000",
  10,
); // 500MB

// Allow CLI to override via global if set by bin/cli.js
if (global.__PWTRACE_LIMITS__) {
  const lim = global.__PWTRACE_LIMITS__;
  if (lim.maxEntries) MAX_TOTAL_ENTRIES = parseInt(String(lim.maxEntries), 10);
  if (lim.maxEntrySize) MAX_ENTRY_SIZE = parseInt(String(lim.maxEntrySize), 10);
  if (lim.maxTotal) MAX_TOTAL_UNCOMPRESSED = parseInt(String(lim.maxTotal), 10);
}

function validateZip(zip) {
  let total = 0;
  const entries = zip.getEntries();
  if (entries.length > MAX_TOTAL_ENTRIES) {
    throw new Error(
      `Zip too large: ${entries.length} entries (max ${MAX_TOTAL_ENTRIES})`,
    );
  }
  for (const e of entries) {
    const name = e.entryName.replace(/\\/g, "/");
    if (name.startsWith("/") || name.includes("../")) {
      throw new Error(`Unsafe zip entry path: ${e.entryName}`);
    }
    // Size checks (best-effort: adm-zip exposes header size via header.size?)
    const size =
      e.header && typeof e.header.size === "number"
        ? e.header.size
        : (e.getData && e.getData().length) || 0;
    if (size > MAX_ENTRY_SIZE) {
      throw new Error(`Zip entry too large: ${e.entryName} (${size} bytes)`);
    }
    total += size;
    if (total > MAX_TOTAL_UNCOMPRESSED) {
      throw new Error(
        `Zip uncompressed size exceeds limit (${MAX_TOTAL_UNCOMPRESSED} bytes)`,
      );
    }
  }
}

class Trace {
  constructor(zipPath) {
    if (!fs.existsSync(zipPath)) {
      throw new Error(`Trace file not found: ${zipPath}`);
    }

    this.zipPath = zipPath;

    try {
      this.zip = new AdmZip(zipPath);
      validateZip(this.zip);
    } catch (err) {
      throw new Error(`Failed to read zip file: ${err.message}`);
    }

    this.events = [];
    this.actions = [];
    this.metadata = null;
  }

  load() {
    let traceContent;
    try {
      traceContent = this.zip.readAsText("trace.trace");
    } catch (err) {
      throw new Error(
        `Invalid trace file: missing trace.trace entry. Is this a Playwright trace?`,
      );
    }

    if (!traceContent) {
      throw new Error(
        `Invalid trace file: trace.trace is empty. Is this a Playwright trace?`,
      );
    }

    try {
      this.events = parseTrace(traceContent);
    } catch (err) {
      throw new Error(`Failed to parse trace: ${err.message}`);
    }

    this.metadata = this._extractMetadata();
    this.actions = this._buildActions();
    return this;
  }

  _extractMetadata() {
    const contextEvent = this.events.find((e) => e.type === "context-options");
    return {
      browserName: contextEvent?.browserName,
      viewport: contextEvent?.options?.viewport,
      baseURL: contextEvent?.options?.baseURL,
      wallTime: contextEvent?.wallTime,
    };
  }

  _buildActions() {
    const beforeEvents = this.events.filter((e) => e.type === "before");
    const actions = [];
    const tracingGroups = new Map();

    for (const before of beforeEvents) {
      const after = this.events.find(
        (e) => e.type === "after" && e.callId === before.callId,
      );

      if (!after) continue;

      if (before.method === "tracingGroup") {
        tracingGroups.set(before.callId, {
          title: before.title || null,
          parentId: before.parentId,
          stack: before.stack || null,
        });
      }

      const getNestingDepth = (parentId) => {
        let depth = 0;
        let current = parentId;
        while (current && tracingGroups.has(current)) {
          depth++;
          current = tracingGroups.get(current).parentId;
        }
        return depth;
      };

      let stepTitle = null;
      let nestingDepth = 0;
      let sourceLocation = null;

      if (before.method === "tracingGroup") {
        stepTitle = before.title;
        nestingDepth = getNestingDepth(before.parentId);
        // Extract source location from stack
        if (before.stack && before.stack.length > 0) {
          sourceLocation = before.stack[0];
        }
      } else if (before.parentId && tracingGroups.has(before.parentId)) {
        const group = tracingGroups.get(before.parentId);
        stepTitle = group.title;
        nestingDepth = getNestingDepth(before.parentId);
        sourceLocation =
          group.stack && group.stack.length > 0 ? group.stack[0] : null;
      }

      actions.push({
        callId: before.callId,
        method: before.method,
        params: before.params,
        startTime: before.startTime,
        endTime: after.endTime,
        duration: after.endTime - before.startTime,
        error: after.error,
        status: after.error ? "failed" : "passed",
        beforeSnapshot: before.beforeSnapshot,
        afterSnapshot: after.afterSnapshot,
        stepTitle: stepTitle,
        nestingDepth: nestingDepth,
        sourceLocation: sourceLocation,
      });
    }

    return actions;
  }

  getAction(index) {
    return this.actions[index - 1];
  }

  getFailedActions() {
    return this.actions.filter((a) => a.status === "failed");
  }

  getScreenshots() {
    return this.zip
      .getEntries()
      .filter(
        (entry) =>
          entry.entryName.startsWith("resources/") &&
          entry.entryName.endsWith(".jpeg"),
      )
      .map((entry) => ({
        name: entry.entryName,
        timestamp: this._extractTimestamp(entry.entryName),
      }));
  }

  getSnapshot(snapshotName) {
    const snapshotEvent = this.events.find(
      (e) =>
        e.type === "frame-snapshot" &&
        e.snapshot?.snapshotName === snapshotName,
    );
    return snapshotEvent?.snapshot || null;
  }

  getSnapshotNearTime(timestamp) {
    const snapshots = this.events
      .filter((e) => e.type === "frame-snapshot" && e.snapshot?.html)
      .map((e) => e.snapshot)
      .filter((s) => {
        const html = s.html;
        return (
          Array.isArray(html) && html.length > 2 && typeof html[0] === "string"
        );
      });

    if (snapshots.length === 0) return null;

    snapshots.sort((a, b) => {
      const diffA = Math.abs(a.timestamp - timestamp);
      const diffB = Math.abs(b.timestamp - timestamp);
      return diffA - diffB;
    });

    return snapshots[0];
  }

  getActionSnapshot(action) {
    // input@ snapshots aren't in action metadata, need to find by pattern
    // Extract callId from beforeSnapshot or afterSnapshot
    const beforeSnap = action.beforeSnapshot;
    const afterSnap = action.afterSnapshot;

    let callId = null;
    if (beforeSnap) {
      const match = beforeSnap.match(/@call@(\d+)$/);
      if (match) callId = match[1];
    } else if (afterSnap) {
      const match = afterSnap.match(/@call@(\d+)$/);
      if (match) callId = match[1];
    }

    if (!callId) return null;

    const inputSnapshotName = `input@call@${callId}`;
    return this.getSnapshot(inputSnapshotName);
  }

  _extractTimestamp(filename) {
    const match = filename.match(/-(\d+)\.jpeg$/);
    return match ? parseInt(match[1], 10) : null;
  }
}

module.exports = Trace;
