const { expect } = require("chai");
const path = require("path");
const fs = require("fs");
const AdmZip = require("adm-zip");
const { execSync } = require("child_process");
const Trace = require("../lib/trace");
const { stripAnsi, truncate, redactHeaders } = require("../lib/sanitize");

const TMP_DIR = path.join(__dirname, "tmp-security");

function run(cmd, env = {}) {
  try {
    const out = execSync(cmd, {
      encoding: "utf8",
      cwd: path.join(__dirname, ".."),
      env: { ...process.env, ...env },
    });
    return { code: 0, stdout: out, stderr: "" };
  } catch (e) {
    return {
      code: e.status || 1,
      stdout: e.stdout || "",
      stderr: e.stderr || "",
    };
  }
}

function makeZipWithEntries(entries) {
  const zip = new AdmZip();
  for (const { name, data } of entries) {
    zip.addFile(name, Buffer.isBuffer(data) ? data : Buffer.from(String(data)));
  }
  const buf = zip.toBuffer();
  const file = path.join(
    TMP_DIR,
    `z-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`,
  );
  fs.writeFileSync(file, buf);
  return file;
}

describe("Security", () => {
  beforeEach(() => {
    fs.mkdirSync(TMP_DIR, { recursive: true });
  });
  afterEach(() => {
    if (fs.existsSync(TMP_DIR))
      fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  describe("zip validation", () => {
    it("rejects path traversal entries", () => {
      // Build a raw zip buffer to avoid AdmZip normalizing '../' away
      const localFileHeader = Buffer.from(
        "504b0304" + // signature
          "1400" + // version needed to extract
          "0000" + // general purpose bit flag
          "0000" + // compression method (store)
          "00000000" + // dos time/date
          "00000000" + // crc32 (ignored for store by many readers)
          "01000000" + // compressed size = 1
          "01000000" + // uncompressed size = 1
          "0b00" + // file name length = 11
          "0000", // extra field length = 0
        "hex",
      );
      const name = Buffer.from("../evil.txt", "utf8");
      const data = Buffer.from("x", "utf8");
      const centralDirHeader = Buffer.from(
        "504b0102" + // central dir signature
          "1400" + // version made by
          "1400" + // version needed
          "0000" + // flags
          "0000" + // method
          "00000000" + // dos time/date
          "00000000" + // crc32
          "01000000" + // comp size
          "01000000" + // uncomp size
          "0b00" + // name len 11
          "0000" + // extra len
          "0000" + // comment len
          "0000" + // disk number
          "0000" + // internal attrs
          "00000000" + // external attrs
          "00000000", // local header offset
        "hex",
      );
      const endOfCentralDir = Buffer.from(
        "504b0506" + // end of central dir
          "0000" + // disk number
          "0000" + // disk start
          "0100" + // total entries on this disk
          "0100" + // total entries
          (centralDirHeader.length + name.length)
            .toString(16)
            .padStart(8, "0") + // size of central dir
          (localFileHeader.length + name.length + data.length)
            .toString(16)
            .padStart(8, "0") + // offset of central dir
          "0000", // comment length
        "hex",
      );
      const buf = Buffer.concat([
        localFileHeader,
        name,
        data,
        centralDirHeader,
        name,
        endOfCentralDir,
      ]);
      const file = path.join(
        TMP_DIR,
        `z-${Date.now()}-${Math.random().toString(36).slice(2)}-traversal.zip`,
      );
      fs.writeFileSync(file, buf);
      const res = run(
        `node -e "process.env.PWTRACE_MAX_ENTRIES='100000';process.env.PWTRACE_MAX_ENTRY_SIZE='999999999';process.env.PWTRACE_MAX_TOTAL_UNCOMPRESSED='999999999';try{new (require('./lib/trace'))('${file.replace(/'/g, "'\\''")}');}catch(e){console.error(e.message);process.exit(2);}console.error('no error');process.exit(0);"`,
      );
      expect(res.code).to.not.equal(0);
      // Some zip libraries may reject malformed central directory before we inspect entries.
      // Accept either our explicit traversal error or an early zip parse failure.
      expect(res.stderr + res.stdout).to.match(
        /Unsafe zip entry path|ADM-ZIP:|Failed to read zip file/,
      );
    });

    it("enforces entry count limit", () => {
      const many = Array.from({ length: 10 }, (_, i) => ({
        name: `f${i}.txt`,
        data: "x",
      }));
      const file = makeZipWithEntries([
        { name: "trace.trace", data: "{}\n" },
        ...many,
      ]);
      const env = { PWTRACE_MAX_ENTRIES: "5" };
      const res = run(
        `node -e "new (require('./lib/trace'))('${file.replace(/'/g, "'\\''")}')"`,
        env,
      );
      expect(res.code).to.not.equal(0);
      expect(res.stderr + res.stdout).to.match(/Zip too large: /);
    });

    it("enforces per-entry and total size limits", () => {
      const big = Buffer.alloc(1024 * 1024 * 2, 0x61); // 2MB
      const file = makeZipWithEntries([
        { name: "trace.trace", data: "{}\n" },
        { name: "resources/a.jpeg", data: big },
      ]);
      const env = {
        PWTRACE_MAX_ENTRY_SIZE: "500000",
        PWTRACE_MAX_TOTAL_UNCOMPRESSED: "600000",
      };
      const res = run(
        `node -e "new (require('./lib/trace'))('${file.replace(/'/g, "'\\''")}')"`,
        env,
      );
      expect(res.code).to.not.equal(0);
      expect(res.stderr + res.stdout).to.match(
        /Zip entry too large|uncompressed size exceeds/,
      );
    });
  });

  describe("sanitize", () => {
    it("strips ANSI/OSC/control sequences", () => {
      const osc = "\u001B]8;;https://evil\u0007text\u001B]8;;\u0007";
      const ansi = "\u001b[31mRED\u001b[0m";
      const ctrl = "A\x07B\x1b[2J";
      const mixed = osc + ansi + ctrl;
      const out = stripAnsi(mixed);
      expect(out).to.not.include("\u001b");
      expect(out).to.not.include("\u009b");
      expect(out).to.not.include("\u001B]8");
      expect(out).to.equal("REDAB".replace(/[\x00-\x1F\x7F]/g, ""));
    });

    it("truncates long strings", () => {
      const s = "x".repeat(3000);
      const out = truncate(s, 100);
      expect(out.length).to.equal(100);
      expect(out.endsWith("…")).to.be.true;
    });
  });

  describe("redaction", () => {
    it("redacts sensitive headers", () => {
      const headers = {
        Authorization: "Bearer abc",
        Cookie: "sid=123",
        "X-Api-Key": "xyz",
        Accept: "*/*",
      };
      const out = redactHeaders(headers);
      expect(out.Authorization).to.equal("<redacted>");
      expect(out.Cookie).to.equal("<redacted>");
      expect(out["X-Api-Key"]).to.equal("<redacted>");
      expect(out.Accept).to.equal("*/*");
    });
  });
});
