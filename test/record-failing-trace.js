const { chromium } = require("playwright");
const path = require("path");

async function recordFailingTrace() {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  await context.tracing.start({ screenshots: true, snapshots: true });

  const page = await context.newPage();

  await page.goto("https://github.com/");

  try {
    await page.click('button:has-text("This Button Does Not Exist")', {
      timeout: 5000,
    });
  } catch (error) {
    console.log("Expected error caught:", error.message);
  }

  const tracePath = path.join(
    __dirname,
    "..",
    "test",
    "fixtures",
    "github-failure.zip",
  );
  await context.tracing.stop({ path: tracePath });

  await browser.close();

  console.log(`Failing trace saved to: ${tracePath}`);
}

recordFailingTrace().catch(console.error);
