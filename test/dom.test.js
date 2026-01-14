const { expect } = require("chai");
const {
  htmlArrayToString,
  findAllNodes,
  isInteractive,
} = require("../lib/dom");

describe("DOM utilities", () => {
  describe("htmlArrayToString()", () => {
    it("should convert simple element to HTML string", () => {
      const input = ["BUTTON", { class: "btn" }, "Click me"];
      const output = htmlArrayToString(input);

      expect(output).to.include("<button");
      expect(output).to.include('class="btn"');
      expect(output).to.include("Click me");
      expect(output).to.include("</button>");
    });

    it("should handle nested elements", () => {
      const input = ["DIV", {}, ["SPAN", {}, "Hello"]];
      const output = htmlArrayToString(input);

      expect(output).to.include("<div>");
      expect(output).to.include("<span>");
      expect(output).to.include("Hello");
      expect(output).to.include("</span>");
      expect(output).to.include("</div>");
    });

    it("should filter out playwright internal attributes", () => {
      const input = [
        "BUTTON",
        { __playwright_target__: "foo", class: "btn" },
        "Click",
      ];
      const output = htmlArrayToString(input);

      expect(output).to.include('class="btn"');
      expect(output).to.not.include("__playwright_target__");
    });

    it("should handle self-closing tags", () => {
      const input = ["INPUT", { type: "text" }];
      const output = htmlArrayToString(input);

      expect(output).to.match(/<input[^>]*>/);
      expect(output).to.not.include("</input>");
    });

    it("should handle boolean attributes", () => {
      const input = ["BUTTON", { disabled: "" }, "Submit"];
      const output = htmlArrayToString(input);

      expect(output).to.include("disabled");
    });

    it("should handle elements with only text content", () => {
      const input = ["P", {}, "Just text"];
      const output = htmlArrayToString(input);

      expect(output).to.equal("<p>Just text</p>");
    });

    it("should handle multiple children", () => {
      const input = ["DIV", {}, ["SPAN", {}, "First"], ["SPAN", {}, "Second"]];
      const output = htmlArrayToString(input);

      expect(output).to.include("First");
      expect(output).to.include("Second");
    });
  });

  describe("findAllNodes()", () => {
    it("should find all nodes in tree", () => {
      const input = [
        "DIV",
        {},
        ["BUTTON", { id: "btn1" }, "Click"],
        ["BUTTON", { id: "btn2" }, "Submit"],
      ];

      const nodes = findAllNodes(input);

      expect(nodes.length).to.equal(3);
      expect(nodes[0].tag).to.equal("DIV");
      expect(nodes[1].tag).to.equal("BUTTON");
      expect(nodes[2].tag).to.equal("BUTTON");
    });

    it("should extract node properties", () => {
      const input = ["BUTTON", { id: "submit", class: "btn" }, "Submit"];
      const nodes = findAllNodes(input);

      expect(nodes.length).to.equal(1);
      expect(nodes[0].tag).to.equal("BUTTON");
      expect(nodes[0].attrs.id).to.equal("submit");
      expect(nodes[0].attrs.class).to.equal("btn");
      expect(nodes[0].text).to.equal("Submit");
    });

    it("should handle nested structures", () => {
      const input = [
        "HTML",
        {},
        ["BODY", {}, ["DIV", {}, ["BUTTON", {}, "Click"]]],
      ];

      const nodes = findAllNodes(input);
      expect(nodes.length).to.equal(4);
    });
  });

  describe("isInteractive()", () => {
    it("should identify buttons as interactive", () => {
      const node = { tag: "BUTTON", attrs: {}, text: "Click" };
      expect(isInteractive(node)).to.be.true;
    });

    it("should identify inputs as interactive", () => {
      const node = { tag: "INPUT", attrs: { type: "text" }, text: "" };
      expect(isInteractive(node)).to.be.true;
    });

    it("should identify selects as interactive", () => {
      const node = { tag: "SELECT", attrs: {}, text: "" };
      expect(isInteractive(node)).to.be.true;
    });

    it("should identify textareas as interactive", () => {
      const node = { tag: "TEXTAREA", attrs: {}, text: "" };
      expect(isInteractive(node)).to.be.true;
    });

    it("should identify links as interactive", () => {
      const node = { tag: "A", attrs: { href: "/foo" }, text: "Link" };
      expect(isInteractive(node)).to.be.true;
    });

    it("should not identify divs as interactive", () => {
      const node = { tag: "DIV", attrs: {}, text: "" };
      expect(isInteractive(node)).to.be.false;
    });

    it("should not identify spans as interactive", () => {
      const node = { tag: "SPAN", attrs: {}, text: "" };
      expect(isInteractive(node)).to.be.false;
    });

    it("should not identify links without href as interactive", () => {
      const node = { tag: "A", attrs: {}, text: "Link" };
      expect(isInteractive(node)).to.be.false;
    });
  });
});
