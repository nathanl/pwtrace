#!/usr/bin/env node

const { Command } = require("commander");
const showCommand = require("../lib/commands/show");
const summaryCommand = require("../lib/commands/summary");
const stepCommand = require("../lib/commands/step");
const consoleCommand = require("../lib/commands/console");
const domCommand = require("../lib/commands/dom");
const screenshotCommand = require("../lib/commands/screenshot");
const networkCommand = require("../lib/commands/network");
const { version } = require("../package.json");

const program = new Command();

program
  .name("pwtrace")
  .description(
    "Extract and analyze Playwright trace files from the command line",
  )
  .version(version)
  .option(
    "--safe",
    "Enable strict sanitization and redaction (default on)",
    true,
  )
  .option("--no-color", "Disable ANSI colors in output")
  .option("--max-size <bytes>", "Max uncompressed zip size in bytes")
  .option("--max-entries <count>", "Max total zip entries")
  .option(
    "--max-entry-size <bytes>",
    "Max per-entry uncompressed size in bytes",
  )
  .addHelpText(
    "after",
    `
 TYPICAL WORKFLOW:
   1. Get overview:      pwtrace trace.zip
   2. Inspect failure:   pwtrace step trace.zip 4
   3. Check DOM state:   pwtrace dom trace.zip --step 4 --interactive
   4. View console:      pwtrace console trace.zip --step 4 --level error
   5. List screenshots:  pwtrace screenshot trace.zip --step 4 --list
   6. Get screenshot:    pwtrace screenshot trace.zip --step 4 --index 2

 COMMON PATTERNS:
   Quick diagnosis:      pwtrace trace.zip
   Failed step details:  pwtrace step trace.zip <N>
   All interactive UI:   pwtrace dom trace.zip --step <N> --interactive
   Find element:         pwtrace dom trace.zip --step <N> --selector "#login"
   Network failures:     pwtrace network trace.zip --failed
   JSON for piping:      pwtrace show trace.zip --format json | jq '.actions'

 OUTPUT FORMATS:
   Most commands support --format json for programmatic use
   Examples: --format json, --format text, --format table

 LEARN MORE:
   pwtrace <command> --help    Show detailed help for any command
   https://github.com/nlong/pwtrace
`,
  );

program
  .command("show <tracefile>", { isDefault: true })
  .description("Show trace overview with action table highlighting failures")
  .option("--format <format>", "Output format: table, json", "table")
  .addHelpText(
    "after",
    `
 EXAMPLES:
   pwtrace trace.zip                  (show is default)
   pwtrace show trace.zip
   pwtrace show trace.zip --format json
 
 OUTPUT:
   Duration: 2.3s | Actions: 4 | Result: FAILED
   
    # | Status | Action | Target          | Duration | Source         | Error
   ─────────────────────────────────────────────────────────────────────────────────────
    1 | ✓      | goto   | /users/login    | 209ms    | (Not captured) |
    2 | ✓      | fill   | "Email Address" | 21ms     | (Not captured) |
    3 | ✓      | fill   | "Password"      | 18ms     | (Not captured) |
    4 | ✗      | click  | "Sign In"       | 5000ms   | (Not captured) | Timeout waiting...
 
 NOTES:
   - "Source" column shows test source file:line when available in trace
   - Shows "(Not captured)" when source info is not available
`,
  )
  .action(showCommand);

program
  .command("summary <tracefile>")
  .description("Quick stats overview (duration, actions, console, screenshots)")
  .option("--format <format>", "Output format: text, json", "text")
  .addHelpText(
    "after",
    `
 EXAMPLES:
   pwtrace summary trace.zip
   pwtrace summary trace.zip --format json
 
 OUTPUT:
   Trace Summary
   ────────────────────────────────────────
   Duration:     1.3s
   Result:       PASSED
   Actions:      25 (1 goto, 2 fill, 8 click, 12 expect)
   Console:      13 messages (0 errors, 0 warnings, 12 logs)
   Screenshots:  37 captured
`,
  )
  .action(summaryCommand);

program
  .command("step <tracefile> <stepNumber>")
  .description(
    "Deep dive into a specific step (status, selector, error, console)",
  )
  .option("--format <format>", "Output format: text, json", "text")
  .addHelpText(
    "after",
    `
 EXAMPLES:
   pwtrace step trace.zip 4
   pwtrace step trace.zip 4 --format json
 
 OUTPUT:
   Step 4: click
   Test Step: Click non-existent button
   Source: /path/to/test/homepage_test.ts:25
   Status:   FAILED (timeout)
   Duration: 5.0s
   Selector: button:has-text("Sign In")
   
   Error:
     Timeout 5000ms exceeded.
   
   Console Errors (around this step):
     [error] Cannot read property 'id' of undefined
 
 TIP:
   Use 'pwtrace show' to see all step numbers, then drill into specific steps
 
 NOTES:
   - Source shows full file path when available, or "(Not captured)" if not
`,
  )
  .action(stepCommand);

program
  .command("console <tracefile>")
  .description("Show console output (logs, warnings, errors)")
  .option("--level <level>", "Filter by level: error, warning, info", "info")
  .option("--step <number>", "Show console around a specific step")
  .option("--format <format>", "Output format: text, json", "text")
  .addHelpText(
    "after",
    `
 EXAMPLES:
   pwtrace console trace.zip
   pwtrace console trace.zip --level error
   pwtrace console trace.zip --step 4
   pwtrace console trace.zip --step 4 --level warning
 
 OUTPUT:
   [warning] 1.44s  GPU stall due to ReadPixels
   [error]   2.00s  Cannot read property 'id' of undefined
 
 LEVELS:
   error    - Only errors
   warning  - Warnings and errors
   info     - Everything (default)
`,
  )
  .action(consoleCommand);

program
  .command("dom <tracefile>")
  .description(
    "Show DOM state at a specific step (useful for debugging element issues)",
  )
  .requiredOption("--step <number>", "Step number to show DOM for")
  .option("--action", "Show DOM during the action (matches GUI 'Action' tab)")
  .option("--after", "Show DOM after the action completes")
  .option(
    "--interactive",
    "Show only interactive elements (buttons, inputs, links, etc.)",
  )
  .option(
    "--selector <selector>",
    "Filter elements by CSS selector (tag, #id, .class)",
  )
  .option("--raw", "Show full DOM without simplification")
  .option("--format <format>", "Output format: text, json", "text")
  .addHelpText(
    "after",
    `
 SNAPSHOT TIMING:
   (default)  Before action starts (matches GUI 'Before' tab)
   --action   During the action (matches GUI 'Action' tab)
   --after    After action completes (matches GUI 'After' tab)
   
   These match the three tabs in the Playwright Trace Viewer.
   Note: --action and --after are mutually exclusive.

 EXAMPLES:
   pwtrace dom trace.zip --step 4
   pwtrace dom trace.zip --step 4 --action
   pwtrace dom trace.zip --step 4 --after
   pwtrace dom trace.zip --step 4 --interactive
   pwtrace dom trace.zip --step 4 --selector button
   pwtrace dom trace.zip --step 4 --selector "#submit-btn"
   pwtrace dom trace.zip --step 4 --raw
 
 OUTPUT:
   DOM at step 4 (before)
   URL: https://example.com/login
   ────────────────────────────────────────
   
   <html>
     <body>
       <button id="submit-btn">Sign In</button>
       <input type="text" placeholder="Email" />
     </body>
   </html>
 
 USE CASES:
   Element not found?     Use --interactive to see what's clickable
   Wrong selector?        Use --selector to test if element exists
   State changed?         Compare --step N vs --step N --after
   Page navigated?        Use --action to see DOM during navigation
   Need raw HTML?         Use --raw for unprocessed DOM
`,
  )
  .action(domCommand);

program
  .command("screenshot <tracefile>")
  .description("Extract screenshot from trace to JPEG file")
  .requiredOption("--step <number>", "Step number (required)")
  .option("--list", "List available screenshots with timing info")
  .option("--index <number>", "Extract specific screenshot by index")
  .option(
    "--format <format>",
    "Output format for --list: text, json (default: text)",
    "text",
  )
  .option("--output <dir>", "Output directory (default: current directory)")
  .option("--base64", "Output base64-encoded image data instead of saving file")
  .option("--binary", "Output raw binary image data to stdout (for piping)")
  .addHelpText(
    "after",
    `
 WORKFLOW:
   1. List available screenshots for a step
   2. Choose which screenshot to extract by index
 
 EXAMPLES:
   # List available screenshots for step 2
   pwtrace screenshot trace.zip --step 2 --list
   
   # List in JSON format
   pwtrace screenshot trace.zip --step 2 --list --format json
   
   # Extract specific screenshot by index
   pwtrace screenshot trace.zip --step 2 --index 2
   
   # Extract as base64 (useful for LLMs)
   pwtrace screenshot trace.zip --step 2 --index 2 --base64
   
   # Extract as binary (for piping)
   pwtrace screenshot trace.zip --step 2 --index 2 --binary > output.jpg
 
 OUTPUT FILES:
   --step 2 --index 5  saves as: step-2-screenshot-5.jpeg
 
 NOTES:
   - Must specify either --list or --index (not both)
   - --base64 and --binary only work with --index
   - Use --list first to see available screenshots and their timing
`,
  )
  .action(screenshotCommand);

program
  .command("network <tracefile>")
  .description("Show network requests (method, URL, status, duration)")
  .option("--failed", "Show only failed requests (status >= 400)")
  .option("--format <format>", "Output format: table, json", "table")
  .addHelpText(
    "after",
    `
 EXAMPLES:
   pwtrace network trace.zip
   pwtrace network trace.zip --failed
   pwtrace network trace.zip --format json
 
 OUTPUT:
    Method | URL                                    | Status | Duration
   ───────────────────────────────────────────────────────────────────
    GET    | https://example.com/api/users          | 200    | 72ms
    POST   | https://example.com/api/login          | 401    | 238ms
    GET    | https://example.com/styles.css         | 200    | 17ms
 
 USE CASES:
   API failures?          Use --failed to see only errors
   Slow requests?         Check duration column
   Missing requests?      Look for expected URLs
`,
  )
  .action(networkCommand);

// Wire CLI flags to limits for child modules
const opts = program.opts();
if (opts.maxSize || opts.maxEntries || opts.maxEntrySize) {
  global.__PWTRACE_LIMITS__ = {
    maxTotal: opts.maxSize ? parseInt(String(opts.maxSize), 10) : undefined,
    maxEntries: opts.maxEntries
      ? parseInt(String(opts.maxEntries), 10)
      : undefined,
    maxEntrySize: opts.maxEntrySize
      ? parseInt(String(opts.maxEntrySize), 10)
      : undefined,
  };
}

program.parse();
