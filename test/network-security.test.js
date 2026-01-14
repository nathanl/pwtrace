const { expect } = require("chai");
const path = require("path");
const { execSync } = require("child_process");

const PASSING_TRACE = path.join(__dirname, "fixtures", "github-signin.zip");

function run(cmd) {
  try {
    const output = execSync(cmd, {
      encoding: "utf8",
      cwd: path.join(__dirname, ".."),
    });
    return { stdout: output, stderr: "", exitCode: 0 };
  } catch (error) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      exitCode: error.status || 1,
    };
  }
}

describe("Network redaction", () => {
  it("redacts sensitive headers in json output", () => {
    const res = run(`node bin/cli.js network ${PASSING_TRACE} --format json`);
    expect(res.exitCode).to.equal(0);
    const arr = JSON.parse(res.stdout);
    expect(arr).to.be.an("array");
    if (arr.length) {
      const any = arr.find(
        (r) => r.request_headers && Object.keys(r.request_headers).length,
      );
      if (any) {
        const headers = any.request_headers;
        for (const k of Object.keys(headers)) {
          if (/authorization|cookie|x-api-key|api-key|token/i.test(k)) {
            expect(headers[k]).to.equal("<redacted>");
          }
        }
      }
    }
  });
});
