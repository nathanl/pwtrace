const { chromium } = require("playwright");
const path = require("path");

async function recordTrace() {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  await context.tracing.start({ screenshots: true, snapshots: true });

  const page = await context.newPage();

  await page.goto("https://github.com/");

  const signInLink = page.getByRole("link", { name: "Sign in" });
  await signInLink.waitFor();

  await signInLink.click();

  const heading = page.locator('h1:has-text("Sign in to GitHub")');
  await heading.waitFor();

  const tracePath = path.join(
    __dirname,
    "..",
    "test",
    "fixtures",
    "github-signin.zip",
  );
  await context.tracing.stop({ path: tracePath });

  await browser.close();

  console.log(`Trace saved to: ${tracePath}`);
}

recordTrace().catch(console.error);
