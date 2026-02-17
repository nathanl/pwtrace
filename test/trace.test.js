const { expect } = require("chai");
const path = require("path");
const Trace = require("../lib/trace");

const PASSING_TRACE = path.join(__dirname, "fixtures", "github-signin.zip");
const FAILING_TRACE = path.join(__dirname, "fixtures", "github-failure.zip");

describe("Trace", () => {
  describe("load()", () => {
    it("should load a passing trace", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();

      expect(trace.events).to.be.an("array");
      expect(trace.events.length).to.be.greaterThan(0);
      expect(trace.actions).to.be.an("array");
      expect(trace.actions.length).to.be.greaterThan(0);
    });

    it("should load a failing trace", () => {
      const trace = new Trace(FAILING_TRACE);
      trace.load();

      expect(trace.events).to.be.an("array");
      expect(trace.actions).to.be.an("array");
    });

    it("should extract metadata", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();

      expect(trace.metadata).to.be.an("object");
      expect(trace.metadata.browserName).to.equal("chromium");
      expect(trace.metadata.wallTime).to.be.a("number");
      expect(trace.metadata.monotonicTime).to.be.a("number");
    });
  });

  describe("actions", () => {
    it("should build actions from before/after events", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();

      expect(trace.actions.length).to.equal(5);

      trace.actions.forEach((action) => {
        expect(action).to.have.property("method");
        expect(action).to.have.property("startTime");
        expect(action).to.have.property("endTime");
        expect(action).to.have.property("duration");
        expect(action).to.have.property("status");
      });
    });

    it("should detect passed actions", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();

      const passed = trace.actions.filter((a) => a.status === "passed");
      expect(passed.length).to.equal(5);
    });

    it("should detect failed actions", () => {
      const trace = new Trace(FAILING_TRACE);
      trace.load();

      const failed = trace.getFailedActions();
      expect(failed.length).to.equal(1);
      expect(failed[0].error).to.exist;
      expect(failed[0].error.message).to.include("Timeout");
    });

    it("should calculate action duration", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();

      trace.actions.forEach((action) => {
        expect(action.duration).to.be.a("number");
        expect(action.duration).to.be.greaterThan(0);
        expect(action.duration).to.equal(action.endTime - action.startTime);
      });
    });
  });

  describe("getTotalDuration()", () => {
    it("should calculate total duration as span from first start to last end", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();

      const totalDuration = trace.getTotalDuration();
      expect(totalDuration).to.be.a("number");
      expect(totalDuration).to.be.greaterThan(0);

      // Total duration should be max(endTime) - min(startTime)
      const minStart = Math.min(...trace.actions.map((a) => a.startTime));
      const maxEnd = Math.max(...trace.actions.map((a) => a.endTime));
      expect(totalDuration).to.equal(maxEnd - minStart);
    });

    it("should return 0 for empty trace", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();
      trace.actions = []; // Empty the actions

      const totalDuration = trace.getTotalDuration();
      expect(totalDuration).to.equal(0);
    });
  });

  describe("getAction()", () => {
    it("should get action by 1-based index", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();

      const action = trace.getAction(1);
      expect(action).to.exist;
      expect(action.method).to.equal("newPage");
    });

    it("should return undefined for invalid index", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();

      expect(trace.getAction(0)).to.be.undefined;
      expect(trace.getAction(999)).to.be.undefined;
    });
  });

  describe("getFailedActions()", () => {
    it("should return empty array for passing trace", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();

      const failed = trace.getFailedActions();
      expect(failed).to.be.an("array");
      expect(failed.length).to.equal(0);
    });

    it("should return failed actions for failing trace", () => {
      const trace = new Trace(FAILING_TRACE);
      trace.load();

      const failed = trace.getFailedActions();
      expect(failed.length).to.equal(1);
      expect(failed[0].status).to.equal("failed");
    });
  });

  describe("getScreenshots()", () => {
    it("should extract screenshots from trace", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();

      const screenshots = trace.getScreenshots();
      expect(screenshots).to.be.an("array");
      expect(screenshots.length).to.be.greaterThan(0);

      screenshots.forEach((ss) => {
        expect(ss).to.have.property("name");
        expect(ss).to.have.property("timestamp");
        expect(ss.name).to.match(/\.jpeg$/);
      });
    });
  });

  describe("getSnapshot()", () => {
    it("should get snapshot by name", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();

      const action = trace.actions[1];
      if (action.beforeSnapshot) {
        const snapshot = trace.getSnapshot(action.beforeSnapshot);
        expect(snapshot).to.exist;
      }
    });
  });

  describe("getSnapshotNearTime()", () => {
    it("should find snapshot near timestamp", () => {
      const trace = new Trace(PASSING_TRACE);
      trace.load();

      const action = trace.actions[1];
      const snapshot = trace.getSnapshotNearTime(action.startTime);

      if (snapshot) {
        expect(snapshot).to.have.property("html");
        expect(snapshot.html).to.be.an("array");
      }
    });
  });
});
