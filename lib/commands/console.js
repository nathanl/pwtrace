const Trace = require("../trace");
const { stripAnsi, truncate } = require("../sanitize");

function formatTime(ms) {
  return `${(ms / 1000).toFixed(2)}s`;
}

function safeText(s) {
  return truncate(stripAnsi(String(s ?? "")), 2000);
}

async function consoleCommand(tracefile, options) {
  try {
    const trace = new Trace(tracefile);
    trace.load();

    let consoleEvents = trace.events.filter((e) => e.type === "console");

    if (options.level) {
      const allowedLevels = {
        error: ["error"],
        warning: ["error", "warning"],
        info: ["error", "warning", "info", "log"],
      };
      const levels = allowedLevels[options.level] || [
        "error",
        "warning",
        "info",
        "log",
      ];
      consoleEvents = consoleEvents.filter((e) =>
        levels.includes(e.messageType),
      );
    }

    if (options.step) {
      const step = parseInt(options.step, 10);
      const action = trace.getAction(step);
      if (!action) {
        console.error(`Step ${step} not found`);
        process.exit(1);
      }
      const timeWindow = 1000;
      consoleEvents = consoleEvents.filter((e) => {
        const timeDiff = Math.abs(e.time - action.startTime);
        return timeDiff < timeWindow;
      });
    }

    if (consoleEvents.length === 0) {
      if (options.format === "json") {
        console.log(JSON.stringify([], null, 2));
      } else {
        console.log("\nNo console messages found\n");
      }
      return;
    }

    if (options.format === "json") {
      const output = consoleEvents.map((e) => ({
        level: e.messageType,
        time_ms: e.time,
        text: safeText(e.text),
      }));
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log();
    consoleEvents.forEach((e) => {
      const level = String(e.messageType || "").padEnd(7);
      const time = formatTime(e.time);
      console.log(`[${level}] ${time}  ${safeText(e.text)}`);
    });
    console.log();
  } catch (err) {
    console.error(`Error loading trace: ${err.message}`);
    process.exit(1);
  }
}

module.exports = consoleCommand;
