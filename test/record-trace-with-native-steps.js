const { test, chromium } = require("@playwright/test");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  await context.tracing.start({
    screenshots: true,
    snapshots: true,
  });

  const page = await context.newPage();

  await test.step("Navigate to example.com", async () => {
    await page.goto("https://example.com");
    await page.waitForTimeout(300);
  });

  await test.step("Click documentation link", async () => {
    await page.click('a[href*="iana"]');
    await page.waitForTimeout(500);
  });

  await test.step("Verify page loaded", async () => {
    await page.click("h1");
    await page.waitForTimeout(300);
  });

  await context.tracing.stop({ path: "test-trace-with-steps.zip" });
  await browser.close();

  console.log("Trace with test.step() recorded to test-trace-with-steps.zip");
})();
