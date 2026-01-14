const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  await context.tracing.start({
    screenshots: true,
    snapshots: true,
  });

  const page = await context.newPage();

  try {
    await page.goto("https://example.com");

    await page.evaluate(() =>
      console.log("TEST_STEP: Setup - Navigate to homepage"),
    );
    await page.waitForTimeout(300);

    await page.evaluate(() =>
      console.log("TEST_STEP: Find and click documentation link"),
    );
    await page.click('a[href*="iana"]');
    await page.waitForTimeout(500);

    await page.evaluate(() => console.log("TEST_STEP: Verify header text"));
    await page.click("h1");
    await page.waitForTimeout(300);

    await page.evaluate(() =>
      console.log("TEST_STEP: Click non-existent button"),
    );
    await page.click("button#does-not-exist", { timeout: 2000 });
  } catch (error) {
    console.log("Test failed as expected:", error.message);
  }

  await context.tracing.stop({ path: "test-trace-failing-steps.zip" });
  await browser.close();

  console.log(
    "Failing trace with steps recorded to test-trace-failing-steps.zip",
  );
})();
