const Trace = require("../trace");
const { htmlArrayToString, findAllNodes, isInteractive } = require("../dom");
const { stripAnsi, truncate } = require("../sanitize");

function safe(s, max = 1000) {
  return truncate(stripAnsi(String(s ?? "")), max);
}

async function domCommand(tracefile, options) {
  try {
    const step = parseInt(options.step, 10);
    if (isNaN(step) || step < 1) {
      console.error("--step must be a positive integer");
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

    const snapshotName = options.after
      ? action.afterSnapshot
      : action.beforeSnapshot;
    let snapshot = snapshotName ? trace.getSnapshot(snapshotName) : null;

    if (
      !snapshot ||
      !snapshot.html ||
      (Array.isArray(snapshot.html) && snapshot.html.length <= 2)
    ) {
      const timestamp = options.after ? action.endTime : action.startTime;
      snapshot = trace.getSnapshotNearTime(timestamp);
      if (!snapshot) {
        console.error("No full DOM snapshot found near this step");
        process.exit(1);
      }
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
        timing: options.after ? "after" : "before",
        url: snapshot.frameUrl,
        elements: elements,
      };
      console.log(JSON.stringify(output, null, 2));
      return;
    }

    const closestSnapshot =
      !snapshotName ||
      !snapshot ||
      (Array.isArray(snapshot.html) && snapshot.html.length <= 2);

    if (closestSnapshot) {
      console.log();
      console.log(`DOM at step ${step} (using closest snapshot)`);
      console.log(`URL: ${safe(snapshot.frameUrl, 400)}`);
      console.log("─".repeat(60));
      console.log();
    } else {
      console.log();
      console.log(
        `DOM at step ${step} (${options.after ? "after" : "before"})`,
      );
      console.log(`URL: ${safe(snapshot.frameUrl, 400)}`);
      console.log("─".repeat(60));
      console.log();
    }

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
