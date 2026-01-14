function htmlArrayToString(node, options = {}) {
  const { indent = 0, maxDepth = 10, simplified = true } = options;

  if (typeof node === "string") {
    return node;
  }

  if (Array.isArray(node) && node.length === 2 && typeof node[0] === "number") {
    return "[ref]";
  }

  if (!Array.isArray(node) || node.length === 0) {
    return "";
  }

  const [tagName, attributes, ...children] = node;

  if (typeof tagName !== "string") {
    return "";
  }

  const tag = tagName.toLowerCase();
  const spaces = "  ".repeat(indent);

  const attrs = simplified ? simplifyAttributes(attributes) : attributes;
  const attrString = Object.entries(attrs || {})
    .filter(([key]) => !key.startsWith("__playwright"))
    .map(([key, val]) => {
      if (val === "") return key;
      if (typeof val === "string") return `${key}="${val}"`;
      return `${key}="${JSON.stringify(val)}"`;
    })
    .join(" ");

  const openTag = attrString ? `<${tag} ${attrString}>` : `<${tag}>`;

  const selfClosingTags = ["input", "img", "br", "hr", "meta", "link"];
  const isSelfClosing = selfClosingTags.includes(tag);

  if (indent >= maxDepth) {
    return isSelfClosing
      ? `${spaces}${openTag}`
      : `${spaces}${openTag}...</${tag}>`;
  }

  if (children.length === 0) {
    return isSelfClosing
      ? `${spaces}${openTag}`
      : `${spaces}${openTag}</${tag}>`;
  }

  if (children.length === 1 && typeof children[0] === "string") {
    const text = children[0].trim();
    if (text.length < 50) {
      return `${spaces}${openTag}${text}</${tag}>`;
    }
  }

  const childrenHtml = children
    .map((child) =>
      htmlArrayToString(child, { ...options, indent: indent + 1 }),
    )
    .filter(Boolean)
    .join("\n");

  if (!childrenHtml) {
    return `${spaces}${openTag}</${tag}>`;
  }

  return `${spaces}${openTag}\n${childrenHtml}\n${spaces}</${tag}>`;
}

function simplifyAttributes(attrs) {
  if (!attrs) return {};

  const keep = [
    "id",
    "class",
    "name",
    "type",
    "disabled",
    "href",
    "value",
    "placeholder",
    "required",
  ];
  const simplified = {};

  for (const key of keep) {
    if (attrs[key] !== undefined) {
      simplified[key] = attrs[key];
    }
  }

  return simplified;
}

function findNodeBySelector(node, selector) {
  if (!Array.isArray(node) || node.length < 2) {
    return null;
  }

  const [tagName, attributes, ...children] = node;

  if (typeof tagName !== "string") {
    return null;
  }

  if (matchesSelector(tagName, attributes, selector)) {
    return node;
  }

  for (const child of children) {
    const found = findNodeBySelector(child, selector);
    if (found) return found;
  }

  return null;
}

function matchesSelector(tagName, attributes, selector) {
  if (selector.startsWith("#")) {
    const id = selector.substring(1);
    return attributes?.id === id;
  }

  if (selector.startsWith(".")) {
    const className = selector.substring(1);
    const classes = (attributes?.class || "").split(/\s+/);
    return classes.includes(className);
  }

  const tagMatch = selector.match(/^([a-z0-9\-]+)/i);
  if (tagMatch) {
    return tagName.toLowerCase() === tagMatch[1].toLowerCase();
  }

  return false;
}

function findAllNodes(node, predicate = null) {
  const results = [];

  function traverse(n) {
    if (!Array.isArray(n) || n.length < 2) {
      return;
    }

    const [tagName, attributes, ...children] = n;

    if (typeof tagName === "string") {
      const textContent = children.find((c) => typeof c === "string") || "";

      const nodeObj = {
        tag: tagName,
        attrs: attributes || {},
        text: textContent,
        html: n,
        children: children,
      };

      if (!predicate || predicate(tagName, attributes)) {
        results.push(nodeObj);
      }
    }

    for (const child of children) {
      traverse(child);
    }
  }

  traverse(node);
  return results;
}

function isInteractive(node) {
  const tagName = typeof node === "object" && node.tag ? node.tag : node;
  const attributes = typeof node === "object" && node.attrs ? node.attrs : {};

  const tag = tagName.toLowerCase();
  const interactiveTags = ["button", "input", "select", "textarea", "a"];

  if (interactiveTags.includes(tag)) {
    if (tag === "a" && !attributes?.href) return false;
    return true;
  }

  return false;
}

module.exports = {
  htmlArrayToString,
  findNodeBySelector,
  findAllNodes,
  isInteractive,
  matchesSelector,
};
