const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  formatTable,
  formatTableRow,
  calculateColumnWidths,
} = require("../lib/table");

describe("table", () => {
  describe("calculateColumnWidths", () => {
    it("calculates max width for each column", () => {
      const rows = [
        ["Name", "Age", "City"],
        ["Alice", "25", "New York"],
        ["Bob", "30", "LA"],
      ];

      const widths = calculateColumnWidths(rows);
      assert.deepStrictEqual(widths, [5, 3, 8]);
    });

    it("handles empty rows", () => {
      const widths = calculateColumnWidths([]);
      assert.deepStrictEqual(widths, []);
    });

    it("handles single column", () => {
      const rows = [["Header"], ["Value"], ["LongerValue"]];

      const widths = calculateColumnWidths(rows);
      assert.deepStrictEqual(widths, [11]);
    });
  });

  describe("formatTableRow", () => {
    it("formats row with proper padding", () => {
      const values = ["GET", "http://example.com", "200"];
      const widths = [6, 25, 6];

      const result = formatTableRow(values, widths);
      assert.strictEqual(
        result,
        " GET    | http://example.com        | 200    ",
      );
    });

    it("handles values matching width exactly", () => {
      const values = ["GET", "URL", "200"];
      const widths = [3, 3, 3];

      const result = formatTableRow(values, widths);
      assert.strictEqual(result, " GET | URL | 200 ");
    });
  });

  describe("formatTable", () => {
    it("formats complete table with headers and rows", () => {
      const headers = ["Method", "URL", "Status"];
      const rows = [
        ["GET", "http://example.com", "200"],
        ["POST", "http://api.example.com/users", "201"],
      ];

      const result = formatTable(headers, rows);
      const lines = result.split("\n");

      assert.strictEqual(lines.length, 4);
      assert.strictEqual(
        lines[0],
        " Method | URL                          | Status ",
      );
      assert.strictEqual(
        lines[1],
        "────────────────────────────────────────────────",
      );
      assert.strictEqual(
        lines[2],
        " GET    | http://example.com           | 200    ",
      );
      assert.strictEqual(
        lines[3],
        " POST   | http://api.example.com/users | 201    ",
      );
    });

    it("formats table with failed status symbol", () => {
      const headers = ["Method", "URL", "Status"];
      const rows = [
        ["GET", "http://example.com", "404 ✗"],
        ["GET", "http://example.com/ok", "200"],
      ];

      const result = formatTable(headers, rows);
      const lines = result.split("\n");

      assert.ok(lines[2].includes("404 ✗"));
      assert.ok(lines[3].includes("200"));
    });

    it("handles empty rows", () => {
      const headers = ["Method", "URL", "Status"];
      const rows = [];

      const result = formatTable(headers, rows);
      const lines = result.split("\n");

      assert.strictEqual(lines.length, 2);
      assert.ok(lines[0].includes("Method"));
      assert.ok(lines[1].startsWith("─"));
    });

    it("aligns separators properly with varying column widths", () => {
      const headers = ["A", "B", "C"];
      const rows = [
        ["X", "Y", "Z"],
        ["XX", "YY", "ZZ"],
      ];

      const result = formatTable(headers, rows);
      const lines = result.split("\n");

      assert.strictEqual(lines[0], " A  | B  | C  ");
      assert.strictEqual(lines[1], "──────────────");
      assert.strictEqual(lines[2], " X  | Y  | Z  ");
      assert.strictEqual(lines[3], " XX | YY | ZZ ");
    });

    it("eliminates unnecessary whitespace in wide columns", () => {
      const headers = ["Method", "URL", "Status"];
      const rows = [
        ["GET", "https://example.com/very/long/url/path", "200"],
        ["GET", "https://short.com", "200"],
      ];

      const result = formatTable(headers, rows);
      const lines = result.split("\n");

      const headerParts = lines[0].split("|").map((p) => p.trim());
      assert.strictEqual(headerParts[0], "Method");
      assert.strictEqual(headerParts[1], "URL");
      assert.strictEqual(headerParts[2], "Status");

      const row1Parts = lines[2].split("|").map((p) => p.trim());
      assert.strictEqual(
        row1Parts[1],
        "https://example.com/very/long/url/path",
      );

      const row2Parts = lines[3].split("|").map((p) => p.trim());
      assert.strictEqual(row2Parts[1], "https://short.com");

      const urlColumnWidth = row1Parts[1].length;
      assert.ok(row2Parts[1].length < urlColumnWidth);
    });
  });
});
