const Trace = require("../trace");
const { formatTable } = require("../table");
const { stripAnsi, truncate, redactHeaders } = require("../sanitize");

function safe(s, max = 2000) {
  return truncate(stripAnsi(String(s ?? "")), max);
}

function networkCommand(tracefile, options) {
  const trace = new Trace(tracefile);
  trace.load();

  const networkContent = trace.zip.readAsText("trace.network");
  if (!networkContent) {
    console.log("No network data found in trace");
    return;
  }

  const requests = networkContent
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line))
    .filter((event) => event.type === "resource-snapshot")
    .map((event) => event.snapshot)
    .map((snap) => ({
      ...snap,
      request: {
        ...snap.request,
        headers: redactHeaders(snap.request?.headers || {}),
        url: safe(snap.request?.url, 400),
        method: safe(snap.request?.method, 20),
      },
      response: {
        ...snap.response,
        headers: redactHeaders(snap.response?.headers || {}),
      },
    }));

  const { failed } = options;

  const filtered = failed
    ? requests.filter((r) => (r.response?.status ?? 0) >= 400)
    : requests;

  if (filtered.length === 0) {
    if (failed) {
      console.log("No failed requests found");
    } else {
      console.log("No network requests found");
    }
    return;
  }

  if (options.format === "json") {
    const output = filtered.map((req) => ({
      method: req.request.method,
      url: req.request.url,
      status: req.response.status,
      duration_ms: req.time,
      mime_type: req.response.content.mimeType,
      request_headers: req.request.headers,
      response_headers: req.response.headers,
    }));
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  if (failed) {
    filtered.forEach((req) => {
      const status = req.response.status;
      const method = req.request.method;
      const url = req.request.url;
      const time = req.time.toFixed(0);
      const mimeType = req.response.content.mimeType;

      console.log(`\n${method} ${url} → ${status} (${time}ms)`);

      if (mimeType.includes("json") && req.response.content._sha1) {
        const contentFile = `resources/${req.response.content._sha1}`;
        try {
          const content = trace.zip.readAsText(contentFile);
          if (content) {
            const parsed = JSON.parse(content);
            console.log(`  Response: ${safe(JSON.stringify(parsed), 4000)}`);
          }
        } catch (e) {}
      }
    });
  } else {
    const headers = ["Method", "URL", "Status", "Duration"];
    const rows = filtered.map((req) => {
      const status = req.response.status;
      const statusStr = status >= 400 ? `${status} ✗` : String(status);
      return [
        req.request.method,
        req.request.url,
        statusStr,
        `${req.time.toFixed(0)}ms`,
      ];
    });

    console.log(formatTable(headers, rows));
  }
}

module.exports = networkCommand;
