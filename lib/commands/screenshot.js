const fs = require("fs");
const path = require("path");
const os = require("os");
const Trace = require("../trace");

function ensureSafeDir(dir) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), "pwtrace-"));
  if (!dir) return base;
  const resolved = path.resolve(dir);
  if (!resolved.startsWith(process.cwd())) {
    return base;
  }
  if (!fs.existsSync(resolved)) fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function getImageDimensions(buffer) {
  if (!buffer || buffer.length < 24) return null;

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2;
    while (offset < buffer.length - 8) {
      if (buffer[offset] === 0xff) {
        const marker = buffer[offset + 1];
        if (marker >= 0xc0 && marker <= 0xc3) {
          const height = buffer.readUInt16BE(offset + 5);
          const width = buffer.readUInt16BE(offset + 7);
          return { width, height };
        }
        const segmentLength = buffer.readUInt16BE(offset + 2);
        offset += segmentLength + 2;
      } else {
        offset++;
      }
    }
  }

  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return { width, height };
  }

  return null;
}

function determinePosition(timestamp, startTime, endTime) {
  if (timestamp < startTime) return "before";
  if (timestamp <= endTime) return "during";
  return "after";
}

function listScreenshotsForStep(trace, stepNum, format) {
  const action = trace.getAction(stepNum);
  const screenshots = trace
    .getScreenshots()
    .filter((s) => s.timestamp !== null);

  if (screenshots.length === 0) {
    if (format === "json") {
      console.log(
        JSON.stringify(
          {
            step: stepNum,
            method: action.method,
            startTime: action.startTime,
            endTime: action.endTime,
            duration: action.duration,
            screenshots: [],
          },
          null,
          2,
        ),
      );
    } else {
      console.log(`Step ${stepNum}: ${action.method}`);
      console.log("Timing:");
      console.log(`  Start: ${action.startTime.toFixed(2)}ms`);
      console.log(`  End: ${action.endTime.toFixed(2)}ms`);
      console.log(`  Duration: ${action.duration.toFixed(2)}ms`);
      console.log();
      console.log("No screenshots available in trace");
    }
    return;
  }

  // Calculate info for each screenshot
  const screenshotInfo = screenshots.map((s, idx) => {
    const relTime = s.timestamp - trace.metadata.wallTime;
    const relToStart = relTime - action.startTime;
    const relToEnd = relTime - action.endTime;
    const position = determinePosition(
      relTime,
      action.startTime,
      action.endTime,
    );

    const entry = trace.zip.getEntry(s.name);
    const data = entry.getData();
    const dimensions = getImageDimensions(data);

    return {
      index: idx + 1,
      timestamp: relTime,
      position,
      relativeToStart: relToStart,
      relativeToEnd: relToEnd,
      sizeKB: parseFloat((data.length / 1024).toFixed(1)),
      dimensions,
    };
  });

  if (format === "json") {
    console.log(
      JSON.stringify(
        {
          step: stepNum,
          method: action.method,
          startTime: action.startTime,
          endTime: action.endTime,
          duration: action.duration,
          screenshots: screenshotInfo,
        },
        null,
        2,
      ),
    );
  } else {
    console.log(`Step ${stepNum}: ${action.method}`);
    console.log("Timing:");
    console.log(`  Start: ${action.startTime.toFixed(2)}ms`);
    console.log(`  End: ${action.endTime.toFixed(2)}ms`);
    console.log(`  Duration: ${action.duration.toFixed(2)}ms`);
    console.log();
    console.log(`Available screenshots (${screenshots.length} total):`);

    for (const info of screenshotInfo) {
      const dimStr = info.dimensions
        ? `${info.dimensions.width}x${info.dimensions.height}px`
        : "unknown";

      let timingStr = "";
      if (info.position === "before") {
        timingStr = `${Math.abs(info.relativeToStart).toFixed(2)}ms before start`;
      } else if (info.position === "during") {
        timingStr = `${info.relativeToStart.toFixed(2)}ms after start, ${Math.abs(info.relativeToEnd).toFixed(2)}ms before end`;
      } else {
        timingStr = `${info.relativeToEnd.toFixed(2)}ms after end`;
      }

      console.log(
        `  [${info.index}] at ${info.timestamp.toFixed(1)}ms (${timingStr}) - ${info.sizeKB}KB - ${dimStr}`,
      );

      const positionLabel =
        info.position === "before"
          ? "Before this step"
          : info.position === "during"
            ? "During this step"
            : "After this step";
      console.log(`      ${positionLabel}`);
    }

    console.log();
    console.log("To extract a specific screenshot:");
    console.log(
      `  pwtrace screenshot <tracefile> --step ${stepNum} --index <number>`,
    );
  }
}

function extractScreenshotByIndex(trace, stepNum, index, options) {
  const screenshots = trace
    .getScreenshots()
    .filter((s) => s.timestamp !== null);

  if (screenshots.length === 0) {
    console.error("Error: No screenshots available in trace");
    process.exit(1);
  }

  if (index < 1 || index > screenshots.length) {
    console.error(
      `Error: Invalid index ${index}. Valid range: 1-${screenshots.length}`,
    );
    console.error(`  Use --list to see available screenshots`);
    process.exit(1);
  }

  const selected = screenshots[index - 1];
  const entry = trace.zip.getEntry(selected.name);
  if (!entry) {
    console.error(`Error: Screenshot not found in trace archive`);
    process.exit(1);
  }

  const data = entry.getData();
  if (data.length > 25 * 1024 * 1024) {
    throw new Error("Screenshot too large (>25MB)");
  }

  const dimensions = getImageDimensions(data);

  if (!dimensions) {
    console.log(
      `Warning: Could not determine image dimensions. File may be invalid.`,
    );
  } else if (dimensions.width < 10 || dimensions.height < 10) {
    console.log(
      `Warning: Screenshot appears unusually small (${dimensions.width}x${dimensions.height}px). File may be invalid.`,
    );
  }

  if (data.length < 5000) {
    console.log(
      `Warning: Screenshot file size is unusually small (${(data.length / 1024).toFixed(1)}KB). File may be invalid or empty.`,
    );
  }

  // Binary output
  if (options.binary) {
    process.stdout.write(data);
    return;
  }

  // Base64 output
  if (options.base64) {
    const base64Data = data.toString("base64");
    const mimeType = "image/jpeg";
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    console.log(dataUri);

    if (dimensions) {
      console.error(
        `Image dimensions: ${dimensions.width}x${dimensions.height}px`,
      );
    }
    console.error(`Image size: ${(data.length / 1024).toFixed(1)}KB`);
    return;
  }

  // File output
  const outputDir = ensureSafeDir(options.output || process.cwd());
  const filename = `step-${stepNum}-screenshot-${index}.jpeg`;
  const outputPath = path.join(outputDir, filename);

  fs.writeFileSync(outputPath, data);

  const stats = fs.statSync(outputPath);
  const kb = (stats.size / 1024).toFixed(1);

  let output_str = `Extracted: ${outputPath} (${kb}KB)`;
  if (dimensions) {
    output_str += ` [${dimensions.width}x${dimensions.height}px]`;
  }

  console.log(output_str);
}

function screenshotCommand(tracefile, options) {
  const trace = new Trace(tracefile);
  trace.load();

  const { step, list, index, format, output, base64, binary } = options;

  // Validate step number
  const stepNum = parseInt(step);
  if (isNaN(stepNum) || stepNum < 1) {
    console.error("Error: --step must be a positive integer");
    process.exit(1);
  }

  const action = trace.getAction(stepNum);
  if (!action) {
    console.error(
      `Error: Step ${stepNum} not found (trace has ${trace.actions.length} actions)`,
    );
    process.exit(1);
  }

  // Validate mutually exclusive options
  if (list && index) {
    console.error("Error: Cannot use --list and --index together");
    process.exit(1);
  }

  // Validate base64/binary only with index
  if ((base64 || binary) && !index) {
    console.error("Error: --base64 and --binary can only be used with --index");
    process.exit(1);
  }

  // List mode
  if (list) {
    return listScreenshotsForStep(trace, stepNum, format);
  }

  // Extract mode
  if (index) {
    const idx = parseInt(index);
    if (isNaN(idx)) {
      console.error("Error: --index must be a number");
      process.exit(1);
    }
    return extractScreenshotByIndex(trace, stepNum, idx, {
      output,
      base64,
      binary,
    });
  }

  // Neither list nor index - show error
  console.error("Error: Must specify either --list or --index");
  console.error(
    `  To see available screenshots: pwtrace screenshot ${tracefile} --step ${stepNum} --list`,
  );
  console.error(
    `  To extract a screenshot: pwtrace screenshot ${tracefile} --step ${stepNum} --index <number>`,
  );
  process.exit(1);
}

module.exports = screenshotCommand;
