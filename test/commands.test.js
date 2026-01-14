const { expect } = require("chai");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

const PASSING_TRACE = path.join(__dirname, "fixtures", "github-signin.zip");
const FAILING_TRACE = path.join(__dirname, "fixtures", "github-failure.zip");
const NESTED_GROUPS_TRACE = path.join(
  __dirname,
  "fixtures",
  "trace-with-nested-groups.zip",
);

function runCommand(cmd) {
  try {
    const output = execSync(cmd, {
      encoding: "utf8",
      cwd: path.join(__dirname, ".."),
    });
    return { stdout: output, stderr: "", exitCode: 0 };
  } catch (error) {
    return {
      stdout: error.stdout || "",
      stderr: error.stderr || "",
      exitCode: error.status || 1,
    };
  }
}

describe("CLI Commands", () => {
  describe("show", () => {
    it("should show overview of passing trace", () => {
      const result = runCommand(`node bin/cli.js show ${PASSING_TRACE}`);

      expect(result.stdout).to.include("Duration:");
      expect(result.stdout).to.include("Actions: 5");
      expect(result.stdout).to.include("Result: PASSED");
      expect(result.stdout).to.include("✓");
      expect(result.stdout).to.include("|");
    });

    it("should show overview of failing trace", () => {
      const result = runCommand(`node bin/cli.js show ${FAILING_TRACE}`);

      expect(result.stdout).to.include("Result: FAILED");
      expect(result.stdout).to.include("✗");
      expect(result.stdout).to.include("|");
      expect(result.stdout).to.include("Timeout");
    });

    it("should show table with pipe separators", () => {
      const result = runCommand(`node bin/cli.js show ${PASSING_TRACE}`);

      expect(result.stdout).to.include("Status");
      expect(result.stdout).to.include("Action");
      expect(result.stdout).to.include("Target");
      expect(result.stdout).to.include("Duration");
      expect(result.stdout).to.include("Error");
      expect(result.stdout).to.match(/\d+ \| [✓✗]/);
    });

    it("should output JSON with --format json", () => {
      const result = runCommand(
        `node bin/cli.js show ${PASSING_TRACE} --format json`,
      );

      expect(result.exitCode).to.equal(0);
      const json = JSON.parse(result.stdout);
      expect(json).to.have.property("duration_ms");
      expect(json).to.have.property("result");
      expect(json).to.have.property("actions");
      expect(json.actions).to.be.an("array");
      expect(json.result).to.equal("PASSED");
    });

    it("should show test step groups with proper indentation", () => {
      const result = runCommand(`node bin/cli.js show ${NESTED_GROUPS_TRACE}`);

      expect(result.stdout).to.include("Test Step");
      expect(result.stdout).to.include("Navigate to Sites page");
      expect(result.stdout).to.include("→ Look for the tenant name");
      expect(result.stdout).to.match(/\s{2}Navigate to Sites page/);
      expect(result.stdout).to.match(/\s{2}→ Look for the tenant name/);
      expect(result.stdout).to.match(/\s{4}Look for the tenant name/);
    });

    it("should include nesting depth in JSON output", () => {
      const result = runCommand(
        `node bin/cli.js show ${NESTED_GROUPS_TRACE} --format json`,
      );

      expect(result.exitCode).to.equal(0);
      const json = JSON.parse(result.stdout);

      const nestedGroupAction = json.actions.find(
        (a) =>
          a.step_title &&
          a.step_title === "Look for the tenant name" &&
          a.nesting_depth === 1,
      );
      expect(nestedGroupAction).to.exist;
      expect(nestedGroupAction.nesting_depth).to.equal(1);

      const childOfNestedGroup = json.actions.find(
        (a) =>
          a.step_title === "Look for the tenant name" && a.nesting_depth === 2,
      );
      expect(childOfNestedGroup).to.exist;
      expect(childOfNestedGroup.nesting_depth).to.equal(2);
    });
  });

  describe("summary", () => {
    it("should show trace summary", () => {
      const result = runCommand(`node bin/cli.js summary ${PASSING_TRACE}`);

      expect(result.stdout).to.include("Trace Summary");
      expect(result.stdout).to.include("Duration:");
      expect(result.stdout).to.include("Actions:");
      expect(result.stdout).to.include("PASSED");
    });

    it("should show failed result in summary", () => {
      const result = runCommand(`node bin/cli.js summary ${FAILING_TRACE}`);

      expect(result.stdout).to.include("FAILED");
    });
  });

  describe("step", () => {
    it("should show details for specific step", () => {
      const result = runCommand(`node bin/cli.js step ${PASSING_TRACE} 2`);

      expect(result.stdout).to.include("Step 2");
      expect(result.stdout).to.include("goto");
      expect(result.stdout).to.include("PASSED");
    });

    it("should show error details for failed step", () => {
      const result = runCommand(`node bin/cli.js step ${FAILING_TRACE} 3`);

      expect(result.stdout).to.include("Step 3");
      expect(result.stdout).to.include("FAILED");
      expect(result.stdout).to.include("Error:");
      expect(result.stdout).to.include("Timeout");
    });

    it("should handle invalid step number", () => {
      const result = runCommand(`node bin/cli.js step ${PASSING_TRACE} 999`);

      const output = result.stdout + result.stderr;
      expect(output).to.include("not found");
    });

    it("should output JSON with --format json", () => {
      const result = runCommand(
        `node bin/cli.js step ${PASSING_TRACE} 2 --format json`,
      );

      expect(result.exitCode).to.equal(0);
      const json = JSON.parse(result.stdout);
      expect(json).to.have.property("step");
      expect(json).to.have.property("method");
      expect(json).to.have.property("status");
      expect(json).to.have.property("duration_ms");
      expect(json.step).to.equal(2);
    });
  });

  describe("console", () => {
    it("should show console output", () => {
      const result = runCommand(`node bin/cli.js console ${PASSING_TRACE}`);

      expect(result.exitCode).to.equal(0);
    });

    it("should filter by error level", () => {
      const result = runCommand(
        `node bin/cli.js console ${PASSING_TRACE} --level error`,
      );

      expect(result.exitCode).to.equal(0);
    });

    it("should filter by step", () => {
      const result = runCommand(
        `node bin/cli.js console ${PASSING_TRACE} --step 2`,
      );

      expect(result.exitCode).to.equal(0);
    });
  });

  describe("dom", () => {
    it("should show DOM at specific step", () => {
      const result = runCommand(
        `node bin/cli.js dom ${PASSING_TRACE} --step 2`,
      );

      expect(result.stdout).to.include("<");
      expect(result.stdout).to.include(">");
    });

    it("should filter interactive elements", () => {
      const result = runCommand(
        `node bin/cli.js dom ${PASSING_TRACE} --step 3 --interactive`,
      );

      expect(result.exitCode).to.equal(0);
      if (result.stdout.includes("Found")) {
        expect(result.stdout).to.include("Element");
        expect(result.stdout).to.include("Tag:");
      }
    });

    it("should filter by selector", () => {
      const result = runCommand(
        `node bin/cli.js dom ${PASSING_TRACE} --step 2 --selector button`,
      );

      expect(result.exitCode).to.equal(0);
      if (result.stdout.includes("Found")) {
        expect(result.stdout).to.include("Element");
        expect(result.stdout).to.include("Tag:");
      }
    });

    it("should require --step option", () => {
      const result = runCommand(`node bin/cli.js dom ${PASSING_TRACE}`);

      expect(result.exitCode).to.not.equal(0);
    });
  });

  describe("screenshot", () => {
    const outputDir = path.join(__dirname, "tmp");

    beforeEach(() => {
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
    });

    afterEach(() => {
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true });
      }
    });

    it("should extract screenshot by step", () => {
      const result = runCommand(
        `node bin/cli.js screenshot ${PASSING_TRACE} --step 2 --output ${outputDir}`,
      );

      expect(result.stdout).to.include("Extracted:");
      expect(result.stdout).to.include("step-2.jpeg");

      const screenshotPath = path.join(outputDir, "step-2.jpeg");
      expect(fs.existsSync(screenshotPath)).to.be.true;
    });

    it("should extract screenshot at failure", () => {
      const result = runCommand(
        `node bin/cli.js screenshot ${FAILING_TRACE} --failure --output ${outputDir}`,
      );

      expect(result.stdout).to.include("Extracted:");
      expect(result.stdout).to.include("failure.jpeg");

      const screenshotPath = path.join(outputDir, "failure.jpeg");
      expect(fs.existsSync(screenshotPath)).to.be.true;
    });

    it("should require --step or --failure", () => {
      const result = runCommand(
        `node bin/cli.js screenshot ${PASSING_TRACE} --output ${outputDir}`,
      );

      expect(result.stdout).to.include("Must specify");
    });

    it("should output base64 data URI with --base64 flag", () => {
      const result = runCommand(
        `node bin/cli.js screenshot ${PASSING_TRACE} --step 2 --base64 2>&1`,
      );

      const lines = result.stdout.split("\n");
      expect(lines[0]).to.match(/^data:image\/jpeg;base64,/);
      expect(result.stdout).to.include("Image dimensions:");
      expect(result.stdout).to.include("Image size:");
    });
  });

  describe("network", () => {
    it("should list network requests", () => {
      const result = runCommand(`node bin/cli.js network ${PASSING_TRACE}`);

      expect(result.stdout).to.include("Method");
      expect(result.stdout).to.include("URL");
      expect(result.stdout).to.include("Status");
      expect(result.stdout).to.include("Duration");
    });

    it("should filter failed requests", () => {
      const result = runCommand(
        `node bin/cli.js network ${PASSING_TRACE} --failed`,
      );

      expect(result.exitCode).to.equal(0);
    });
  });
});
