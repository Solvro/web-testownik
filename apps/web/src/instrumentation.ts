export function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "production"
  ) {
    // Do not await ranks loading/encoder construction before serving requests.
    // Keep development startup/HMR lazy and Node-only code out of Edge bundles.
    void import("@/app/(landing)/lib/landing-demo-tokenizer.server")
      .then(async ({ warmLandingDemoTokenizer }) => {
        await warmLandingDemoTokenizer();
      })
      .catch(() => {
        console.warn("Landing demo tokenizer warm-up unavailable");
      });
  }
}
