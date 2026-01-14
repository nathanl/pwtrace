const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Start tracing
  await context.tracing.start({
    screenshots: true,
    snapshots: true,
  });

  const page = await context.newPage();

  // Navigate
  await page.goto("https://example.com");

  // Test step 1: Search functionality
  await page.evaluate(() => console.log("TEST_STEP: Verify page title"));
  await page.waitForTimeout(500);

  // Test step 2: Form interaction
  await page.evaluate(() =>
    console.log("TEST_STEP: Navigate to documentation"),
  );
  await page.click('a[href*="iana"]');
  await page.waitForTimeout(1000);

  // Test step 3: Validation
  await page.evaluate(() => console.log("TEST_STEP: Verify content loaded"));
  await page.waitForTimeout(500);

  // Stop tracing and save
  await context.tracing.stop({ path: "test-trace-enhanced.zip" });
  await browser.close();

  console.log("Trace with steps recorded to test-trace-enhanced.zip");
})();
