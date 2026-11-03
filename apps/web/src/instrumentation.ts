export function register() {
  if (
    process.env.NEXT_RUNTIME === "nodejs" &&
    process.env.NODE_ENV === "production"
  ) {
    // Warm the demo tokenizer without blocking startup; Node only.
    void import("@/app/(landing)/lib/landing-demo-tokenizer.server")
      .then(async ({ warmLandingDemoTokenizer }) => {
        await warmLandingDemoTokenizer();
      })
      .catch(() => {
        console.warn("Landing demo tokenizer warm-up unavailable");
      });
  }
}
