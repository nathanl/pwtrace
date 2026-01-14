const { expect } = require("chai");
const { parseTrace } = require("../lib/parser");

describe("Parser", () => {
  describe("parseTrace()", () => {
    it("should parse NDJSON format", () => {
      const ndjson = `{"type":"context-options","browserName":"chromium"}
{"type":"before","callId":"call@1","method":"goto"}
{"type":"after","callId":"call@1"}`;

      const events = parseTrace(ndjson);

      expect(events).to.be.an("array");
      expect(events.length).to.equal(3);
      expect(events[0].type).to.equal("context-options");
      expect(events[1].type).to.equal("before");
      expect(events[2].type).to.equal("after");
    });

    it("should handle empty lines", () => {
      const ndjson = `{"type":"before"}

{"type":"after"}
`;

      const events = parseTrace(ndjson);

      expect(events.length).to.equal(2);
    });

    it("should handle trailing newline", () => {
      const ndjson = `{"type":"before"}
`;

      const events = parseTrace(ndjson);

      expect(events.length).to.equal(1);
    });

    it("should parse event properties", () => {
      const ndjson = `{"type":"before","callId":"call@1","method":"click","params":{"selector":"button"},"startTime":1000}`;

      const events = parseTrace(ndjson);

      expect(events[0]).to.deep.include({
        type: "before",
        callId: "call@1",
        method: "click",
        startTime: 1000,
      });
      expect(events[0].params).to.deep.equal({ selector: "button" });
    });
  });
});
