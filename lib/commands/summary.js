const Trace = require("../trace");
const { stripAnsi, truncate } = require("../sanitize");

function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function countByMethod(actions) {
  const counts = {};
  actions.forEach((action) => {
    counts[action.method] = (counts[action.method] || 0) + 1;
  });
  return counts;
}

function safe(s, max = 400) {
  return truncate(stripAnsi(String(s ?? "")), max);
}

async function summaryCommand(tracefile, options) {
  try {
    const trace = new Trace(tracefile);
    trace.load();

    const totalDuration = trace.getTotalDuration();
    const failed = trace.getFailedActions();
    const result = failed.length > 0 ? "FAILED" : "PASSED";
    const failedAt =
      failed.length > 0
        ? ` at step ${trace.actions.indexOf(failed[0]) + 1}`
        : "";

    const methodCounts = countByMethod(trace.actions);

    const consoleEvents = trace.events.filter((e) => e.type === "console");
    const consoleByLevel = {
      error: consoleEvents.filter((e) => e.messageType === "error").length,
      warning: consoleEvents.filter((e) => e.messageType === "warning").length,
      log: consoleEvents.filter((e) => e.messageType === "log").length,
    };

    const screenshots = trace.getScreenshots();

    if (options.format === "json") {
      const output = {
        duration_ms: totalDuration,
        result: result,
        failed_step:
          failed.length > 0 ? trace.actions.indexOf(failed[0]) + 1 : null,
        actions: {
          total: trace.actions.length,
          by_method: methodCounts,
        },
        console: {
          total: consoleEvents.length,
          errors: consoleByLevel.error,
          warnings: consoleByLevel.warning,
          logs: consoleByLevel.log,
        },
        screenshots: screenshots.length,
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    const actionSummary = Object.entries(methodCounts)
      .map(([method, count]) => `${count} ${safe(method, 40)}`)
      .join(", ");

    console.log();
    console.log("Trace Summary");
    console.log("─".repeat(40));
    console.log(`Duration:     ${formatDuration(totalDuration)}`);
    console.log(`Result:       ${result}${safe(failedAt, 200)}`);
    console.log(`Actions:      ${trace.actions.length} (${actionSummary})`);
    console.log(
      `Console:      ${consoleEvents.length} messages (${consoleByLevel.error} errors, ${consoleByLevel.warning} warnings, ${consoleByLevel.log} logs)`,
    );
    console.log(`Screenshots:  ${screenshots.length} captured`);
    console.log();
  } catch (err) {
    console.error(`Error loading trace: ${err.message}`);
    process.exit(1);
  }
}

module.exports = summaryCommand;
