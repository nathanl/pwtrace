const Trace = require("../trace");
const { htmlArrayToString, findAllNodes, isInteractive } = require("../dom");
const { stripAnsi, truncate } = require("../sanitize");

function safe(s, max = 1000) {
  return truncate(stripAnsi(String(s ?? "")), max);
}

async function domCommand(tracefile, options) {
  try {
    // Validate options
    const step = parseInt(options.step, 10);
    if (isNaN(step) || step < 1) {
      console.error("--step must be a positive integer");
      process.exit(1);
    }

    if (options.action && options.after) {
      console.error("--action and --after are mutually exclusive");
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

    // Determine which snapshot to get
    let snapshotType = "before";
    let snapshotName = null;
    let snapshot = null;
    let fallbackUsed = false;
    let fallbackType = null;

    if (options.action) {
      snapshotType = "action";
      snapshot = trace.getActionSnapshot(action);
      if (!snapshot) {
        console.error(
          `No action snapshot found for step ${step}. This action may not have an input@ snapshot.`,
        );
        process.exit(1);
      }
    } else if (options.after) {
      snapshotType = "after";
      snapshotName = action.afterSnapshot;
      snapshot = snapshotName ? trace.getSnapshot(snapshotName) : null;

      // Check if snapshot is empty and needs fallback
      if (
        !snapshot ||
        !snapshot.html ||
        (Array.isArray(snapshot.html) && snapshot.html.length <= 2)
      ) {
        // Try action snapshot first, then before
        snapshot = trace.getActionSnapshot(action);
        if (
          snapshot &&
          snapshot.html &&
          Array.isArray(snapshot.html) &&
          snapshot.html.length > 2
        ) {
          fallbackUsed = true;
          fallbackType = "action";
        } else {
          snapshot = trace.getSnapshot(action.beforeSnapshot);
          if (
            snapshot &&
            snapshot.html &&
            Array.isArray(snapshot.html) &&
            snapshot.html.length > 2
          ) {
            fallbackUsed = true;
            fallbackType = "before";
          } else {
            snapshot = trace.getSnapshotNearTime(action.endTime);
            fallbackUsed = true;
            fallbackType = "closest";
          }
        }
      }
    } else {
      // Default: before
      snapshotType = "before";
      snapshotName = action.beforeSnapshot;
      snapshot = snapshotName ? trace.getSnapshot(snapshotName) : null;

      // Check if snapshot is empty and needs fallback
      if (
        !snapshot ||
        !snapshot.html ||
        (Array.isArray(snapshot.html) && snapshot.html.length <= 2)
      ) {
        // Try action snapshot first, then after
        snapshot = trace.getActionSnapshot(action);
        if (
          snapshot &&
          snapshot.html &&
          Array.isArray(snapshot.html) &&
          snapshot.html.length > 2
        ) {
          fallbackUsed = true;
          fallbackType = "action";
        } else {
          snapshot = trace.getSnapshot(action.afterSnapshot);
          if (
            snapshot &&
            snapshot.html &&
            Array.isArray(snapshot.html) &&
            snapshot.html.length > 2
          ) {
            fallbackUsed = true;
            fallbackType = "after";
          } else {
            snapshot = trace.getSnapshotNearTime(action.startTime);
            fallbackUsed = true;
            fallbackType = "closest";
          }
        }
      }
    }

    if (!snapshot) {
      console.error("No full DOM snapshot found near this step");
      process.exit(1);
    }

    if (options.format === "json") {
      let elements;

      if (options.interactive) {
        const interactiveElements = findAllNodes(snapshot.html, isInteractive);
        elements = interactiveElements.map((node) => ({
          tag: node.tag,
          attrs: node.attrs,
          text: node.text,
        }));
      } else if (options.selector) {
        const matchingElements = findAllNodes(
          snapshot.html,
          (tagName, attrs) => {
            if (options.selector.startsWith("#")) {
              return attrs?.id === options.selector.substring(1);
            }
            if (options.selector.startsWith(".")) {
              const className = options.selector.substring(1);
              const classes = (attrs?.class || "").split(/\s+/);
              return classes.includes(className);
            }
            return tagName.toLowerCase() === options.selector.toLowerCase();
          },
        );
        elements = matchingElements.map((node) => ({
          tag: node.tag,
          attrs: node.attrs,
          text: node.text,
          children: node.children,
        }));
      } else {
        elements = snapshot.html;
      }

      const output = {
        step: step,
        timing: snapshotType,
        url: snapshot.frameUrl,
        fallbackUsed: fallbackUsed,
        fallbackType: fallbackUsed ? fallbackType : null,
        elements: elements,
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    // Text output
    console.log();
    console.log(`DOM at step ${step} (${snapshotType})`);
    if (fallbackUsed) {
      console.log(
        `Note: ${snapshotType}@ snapshot was empty, showing ${fallbackType}@ snapshot instead`,
      );
    }
    console.log(`URL: ${safe(snapshot.frameUrl, 400)}`);
    console.log("─".repeat(60));
    console.log();

    if (options.interactive) {
      const interactiveElements = findAllNodes(snapshot.html, isInteractive);

      if (interactiveElements.length === 0) {
        console.log("No interactive elements found");
      } else {
        console.log(
          `Found ${interactiveElements.length} interactive element(s):\n`,
        );
        interactiveElements.forEach((node, idx) => {
          console.log(`Element ${idx + 1}:`);
          console.log(`  Tag: ${node.tag}`);

          const relevantAttrs = Object.entries(node.attrs)
            .filter(([key]) => !key.startsWith("__playwright"))
            .filter(([_, val]) => val !== undefined && val !== null);

          if (relevantAttrs.length > 0) {
            console.log(`  Attributes:`);
            relevantAttrs.forEach(([key, val]) => {
              console.log(`    ${key}="${safe(String(val), 100)}"`);
            });
          }

          if (node.text && node.text.trim()) {
            console.log(`  Text: "${safe(node.text.trim(), 200)}"`);
          }

          const html = htmlArrayToString(node.html, { indent: 0, maxDepth: 0 });
          console.log(`  HTML: ${safe(html, 400)}`);
          console.log();
        });
      }
    } else if (options.selector) {
      const matchingElements = findAllNodes(snapshot.html, (tagName, attrs) => {
        if (options.selector.startsWith("#")) {
          return attrs?.id === options.selector.substring(1);
        }
        if (options.selector.startsWith(".")) {
          const className = options.selector.substring(1);
          const classes = (attrs?.class || "").split(/\s+/);
          return classes.includes(className);
        }
        return tagName.toLowerCase() === options.selector.toLowerCase();
      });

      if (matchingElements.length === 0) {
        console.log(
          `No elements matching "${safe(options.selector, 200)}" found`,
        );
      } else {
        console.log(
          `Found ${matchingElements.length} element(s) matching "${safe(options.selector, 200)}":\n`,
        );
        matchingElements.forEach((node, idx) => {
          console.log(`Element ${idx + 1}:`);
          console.log(`  Tag: ${node.tag}`);

          const relevantAttrs = Object.entries(node.attrs)
            .filter(([key]) => !key.startsWith("__playwright"))
            .filter(([_, val]) => val !== undefined && val !== null);

          if (relevantAttrs.length > 0) {
            console.log(`  Attributes:`);
            relevantAttrs.forEach(([key, val]) => {
              console.log(`    ${key}="${safe(String(val), 100)}"`);
            });
          }

          if (node.text && node.text.trim()) {
            console.log(`  Text: "${safe(node.text.trim(), 200)}"`);
          }

          const html = htmlArrayToString(node.html, { indent: 0, maxDepth: 2 });
          console.log(`  HTML:`);
          console.log(
            safe(html, 2000)
              .split("\n")
              .map((line) => `    ${line}`)
              .join("\n"),
          );
          console.log();
        });
      }
    } else {
      const maxDepth = options.raw ? 999 : 10;
      const html = htmlArrayToString(snapshot.html, {
        indent: 0,
        maxDepth,
        simplified: !options.raw,
      });
      console.log(safe(html, 20000));
    }

    console.log();
  } catch (err) {
    console.error(`Error loading trace: ${err.message}`);
    if (process.env.DEBUG) {
      console.error(err.stack);
    }
    process.exit(1);
  }
}

module.exports = domCommand;
