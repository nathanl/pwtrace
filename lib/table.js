const { stripAnsi, truncate } = require("./sanitize");

function safeString(input, max = 2000) {
  return truncate(stripAnsi(String(input ?? "")), max);
}

function formatTableRow(values, columnWidths) {
  return values
    .map((value, i) => {
      const v = safeString(value);
      return ` ${v.padEnd(columnWidths[i])} `;
    })
    .join("|");
}

function calculateColumnWidths(rows) {
  if (rows.length === 0) return [];

  const numColumns = rows[0].length;
  const widths = new Array(numColumns).fill(0);

  rows.forEach((row) => {
    row.forEach((value, i) => {
      const v = safeString(value);
      widths[i] = Math.max(widths[i], v.length);
    });
  });

  return widths;
}

function formatTable(headers, rows) {
  const sanitizedRows = rows.map((r) => r.map((v) => safeString(v)));
  const allRows = [headers.map((h) => safeString(h)), ...sanitizedRows];
  const columnWidths = calculateColumnWidths(allRows);

  const headerLine = formatTableRow(allRows[0], columnWidths);
  const separator = columnWidths.map((w) => "─".repeat(w + 2)).join("─");

  const dataLines = sanitizedRows.map((row) =>
    formatTableRow(row, columnWidths),
  );

  return [headerLine, separator, ...dataLines].join("\n");
}

module.exports = {
  formatTable,
  formatTableRow,
  calculateColumnWidths,
  safeString,
};
