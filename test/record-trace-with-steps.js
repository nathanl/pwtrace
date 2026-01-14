const { chromium } = require("playwright");
const path = require("path");

async function recordTraceWithSteps() {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  await context.tracing.start({ screenshots: true, snapshots: true });

  const page = await context.newPage();

  let callIdCounter = 100;
  
  page.tracingGroup = async function (title, fn) {
    const callId = `call@${callIdCounter++}`;
    const startCallId = callId;
    
    const instrumentation = (this as any)._instrumentation;
    if (instrumentation) {
      const startTime = instrumentation.monotonicTime();
      instrumentation.onBeforeCall(this, {
        sdkObject: this,
        metadata: {
          type: 'API',
          method: 'tracingGroup',
          params: {},
          stack: [],
        },
      });
      
      await instrumentation.onCallLog(
        'api',
        '',
        {
          call: startCallId,
          wallTime: Date.now(),
          startTime,
          endTime: 0,
          type: 'before',
          message: '',
          class: 'Tracing',
          method: 'tracingGroup',
          params: {},
          title,
        }
      );
    }

    const result = await fn();
    
    if (instrumentation) {
      const endTime = instrumentation.monotonicTime();
      await instrumentation.onCallLog(
        'api',
        '',
        {
          call: startCallId,
          wallTime: Date.now(),
          endTime,
          type: 'after',
          message: '',
        }
      );
      
      instrumentation.onAfterCall(this, {});
    }
    
    return result;
  };

  await page.goto("https://example.com");

  await page.tracingGroup("Navigate and verify", async () => {
    await page.click("a");
    await page.waitForLoadState();

    await page.tracingGroup("Verify header text", async () => {
      await page.click("h1");
    });
  });

  await page.tracingGroup("Click back link", async () => {
    await page.click("a").catch(() => {});
  });

  const tracePath = path.join(__dirname, "fixtures", "github-with-steps.zip");
  await context.tracing.stop({ path: tracePath });

  await browser.close();

  console.log(`Trace with step markers saved to: ${tracePath}`);
}

recordTraceWithSteps().catch(console.error);
