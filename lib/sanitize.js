// Utilities for sanitizing and redacting untrusted content

const ANSI_REGEX =
  /[\u001B\u009B][[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g; // CSI/ESC
const OSC_HYPERLINK_REGEX =
  /\u001B\]8;[^\u0007]*\u0007[^\u001B]*\u001B\]8;;\u0007/g; // OSC 8 hyperlinks
const CONTROL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

function stripAnsi(input) {
  if (typeof input !== "string") return input;
  return input
    .replace(OSC_HYPERLINK_REGEX, "")
    .replace(ANSI_REGEX, "")
    .replace(CONTROL_CHARS, "");
}

function truncate(input, max = 2000) {
  if (typeof input !== "string") return input;
  if (input.length <= max) return input;
  return input.slice(0, max - 1) + "…";
}

const SENSITIVE_HEADER_RE =
  /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|x-access-token|api-key|bearer|token)$/i;

function redactHeaders(headers) {
  if (!headers || typeof headers !== "object") return headers;
  const out = {};
  for (const [k, v] of Object.entries(headers)) {
    if (SENSITIVE_HEADER_RE.test(k)) {
      out[k] = "<redacted>";
    } else {
      out[k] = v;
    }
  }
  return out;
}

module.exports = { stripAnsi, truncate, redactHeaders };
