const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
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

function screenshotCommand(tracefile, options) {
  const trace = new Trace(tracefile);
  trace.load();

  const { step, output, failure, base64, binary } = options;

  let targetTime;

  if (failure) {
    const failedAction = trace.getFailedActions()[0];
    if (!failedAction) {
      console.log("No failed action found in trace");
      return;
    }
    targetTime = failedAction.startTime;
  } else if (step) {
    const action = trace.getAction(parseInt(step));
    if (!action) {
      console.log(`Step ${step} not found`);
      return;
    }
    targetTime = action.startTime;
  } else {
    console.log("Must specify --step N or --failure");
    return;
  }

  const screenshots = trace.getScreenshots();
  if (screenshots.length === 0) {
    console.log("No screenshots found in trace");
    return;
  }

  const validScreenshots = screenshots.filter((s) => s.timestamp !== null);
  if (validScreenshots.length === 0) {
    console.log("No screenshots with valid timestamps found in trace");
    return;
  }

  const absoluteTargetTime = trace.metadata.wallTime + targetTime;

  const closest = validScreenshots.reduce((prev, curr) => {
    const prevDiff = Math.abs(prev.timestamp - absoluteTargetTime);
    const currDiff = Math.abs(curr.timestamp - absoluteTargetTime);
    return currDiff < prevDiff ? curr : prev;
  });

  const entry = trace.zip.getEntry(closest.name);
  if (!entry) {
    console.log(`Screenshot ${closest.name} not found in zip`);
    return;
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

  if (binary) {
    process.stdout.write(data);
    return;
  }

  if (base64) {
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

  const outputDir = ensureSafeDir(output || process.cwd());

  const filename = failure ? "failure.jpeg" : `step-${step}.jpeg`;

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

module.exports = screenshotCommand;
