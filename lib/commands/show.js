const Trace = require("../trace");
const { formatTable } = require("../table");
const { stripAnsi, truncate } = require("../sanitize");

function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function safe(s, max = 400) {
  return truncate(stripAnsi(String(s ?? "")), max);
}

function formatTarget(action) {
  if (action.params.url) {
    return safe(action.params.url, 200);
  }
  if (action.params.selector) {
    const selector = action.params.selector;
    return safe(selector, 200);
  }
  if (action.method === "expect") {
    return safe(action.params.expression || "", 200);
  }
  return "";
}

async function showCommand(tracefile, options) {
  try {
    const trace = new Trace(tracefile);
    trace.load();

    const totalDuration = trace.actions.reduce((sum, a) => sum + a.duration, 0);
    const failed = trace.getFailedActions();
    const result = failed.length > 0 ? "FAILED" : "PASSED";

    if (options.format === "json") {
      const output = {
        duration_ms: totalDuration,
        result: result,
        actions: trace.actions.map((action, i) => ({
          step: i + 1,
          status: action.status,
          method: action.method,
          target: formatTarget(action),
          duration_ms: action.duration,
          step_title: action.stepTitle || null,
          nesting_depth: action.nestingDepth || 0,
          error: action.error
            ? safe(
                action.error.error?.message ||
                  action.error.message ||
                  "Unknown error",
                500,
              )
            : null,
        })),
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log();
    console.log(
      `Duration: ${formatDuration(totalDuration)} | Actions: ${trace.actions.length} | Result: ${result}`,
    );
    console.log();

    const hasStepTitles = trace.actions.some((a) => a.stepTitle);
    const headers = hasStepTitles
      ? ["#", "Status", "Action", "Target", "Duration", "Test Step", "Error"]
      : ["#", "Status", "Action", "Target", "Duration", "Error"];

    const rows = trace.actions.map((action, i) => {
      const num = String(i + 1);
      const status = action.status === "passed" ? "✓" : "✗";
      const method = action.method;
      const target = formatTarget(action);
      const duration = formatDuration(action.duration);

      let stepTitle = action.stepTitle || "";
      if (stepTitle && action.nestingDepth > 0) {
        const indent = "  ".repeat(action.nestingDepth);
        const prefix = action.method === "tracingGroup" ? "→ " : "";
        stepTitle = `${indent}${prefix}${safe(stepTitle, 200)}`;
      } else {
        stepTitle = safe(stepTitle, 200);
      }

      const error = action.error
        ? safe(
            action.error.error?.message ||
              action.error.message ||
              "Unknown error",
            400,
          )
        : "";

      return hasStepTitles
        ? [num, status, method, target, duration, stepTitle, error]
        : [num, status, method, target, duration, error];
    });

    console.log(formatTable(headers, rows));

    console.log();
  } catch (err) {
    console.error(`Error loading trace: ${err.message}`);
    process.exit(1);
  }
}

module.exports = showCommand;
