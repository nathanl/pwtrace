const Trace = require("../trace");
const { stripAnsi, truncate } = require("../sanitize");

function formatDuration(ms) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getConsoleAroundStep(trace, action) {
  const consoleEvents = trace.events.filter((e) => e.type === "console");
  const timeWindow = 1000;

  return consoleEvents.filter((e) => {
    const timeDiff = Math.abs(e.time - action.startTime);
    return timeDiff < timeWindow;
  });
}

function safe(s, max = 400) {
  return truncate(stripAnsi(String(s ?? "")), max);
}

function formatSelector(selector) {
  if (!selector) return "";
  return safe(selector, 200);
}

async function stepCommand(tracefile, stepNumber, options) {
  try {
    const step = parseInt(stepNumber, 10);
    if (isNaN(step) || step < 1) {
      console.error("Step number must be a positive integer");
      process.exit(1);
    }

    const trace = new Trace(tracefile);
    trace.load();

    const action = trace.getAction(step);
    if (!action) {
      console.error(
        `Step ${step} not found (trace has ${trace.actions.length} actions)`,
      );
      process.exit(1);
    }

    const consoleNearby = getConsoleAroundStep(trace, action);
    const errors = consoleNearby.filter((e) => e.messageType === "error");

    const screenshots = trace.getScreenshots();
    const beforeScreenshot = screenshots
      .filter((s) => s.timestamp && s.timestamp <= action.startTime)
      .sort((a, b) => b.timestamp - a.timestamp)[0];

    if (options.format === "json") {
      const output = {
        step: step,
        method: action.method,
        status: action.status,
        duration_ms: action.duration,
        step_title: action.stepTitle || null,
        params: {
          url: action.params.url || null,
          selector: action.params.selector || null,
          expression: action.params.expression || null,
        },
        error: action.error
          ? safe(
              action.error.error?.message ||
                action.error.message ||
                JSON.stringify(action.error),
              800,
            )
          : null,
        console_errors: errors.map((e) => safe(e.text, 400)),
        screenshot: beforeScreenshot?.name || null,
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    console.log();
    console.log(`Step ${step}: ${action.method}`);
    if (action.stepTitle) {
      console.log(`Test Step: ${safe(action.stepTitle, 200)}`);
    }
    console.log("═".repeat(60));
    console.log(
      `Status:   ${action.status.toUpperCase()}${action.error ? " (timeout)" : ""}`,
    );
    console.log(`Duration: ${formatDuration(action.duration)}`);

    if (action.params.url) {
      console.log(`URL:      ${safe(action.params.url, 400)}`);
    }

    if (action.params.selector) {
      console.log(`Selector: ${formatSelector(action.params.selector)}`);
    }

    if (action.params.expression) {
      console.log(`Expected: ${formatSelector(action.params.expression)}`);
    }

    if (action.error) {
      console.log();
      console.log("Error:");
      const errorMsg =
        action.error.error?.message ||
        action.error.message ||
        JSON.stringify(action.error);
      console.log(`  ${safe(errorMsg, 800)}`);
    }

    if (errors.length > 0) {
      console.log();
      console.log("Console Errors (around this step):");
      errors.forEach((e) => {
        console.log(`  [error] ${safe(e.text, 400)}`);
      });
    }

    if (beforeScreenshot) {
      console.log();
      console.log(`Screenshot: ${safe(beforeScreenshot.name, 400)}`);
    }

    console.log();
  } catch (err) {
    console.error(`Error loading trace: ${err.message}`);
    process.exit(1);
  }
}

module.exports = stepCommand;
