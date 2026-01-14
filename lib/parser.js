function parseTrace(content) {
  return content
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch (err) {
        console.warn(`Failed to parse line: ${line.substring(0, 50)}...`);
        return null;
      }
    })
    .filter(Boolean);
}

module.exports = { parseTrace };
