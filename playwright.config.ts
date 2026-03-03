import { defineConfig, devices } from "@playwright/test";
import { spawnSync } from "node:child_process";

function isPortOpen(port: number): boolean {
  const probe = spawnSync(
    process.execPath,
    [
      "-e",
      `const net=require("node:net");const s=net.connect(${port},"127.0.0.1");s.on("connect",()=>{s.end();process.exit(0)});s.on("error",()=>process.exit(1));setTimeout(()=>{s.destroy();process.exit(1)},600);`,
    ],
    { stdio: "ignore" }
  );
  return probe.status === 0;
}

function resolveBaseUrl(): string {
  if (process.env.PLAYWRIGHT_BASE_URL) return process.env.PLAYWRIGHT_BASE_URL;
  if (isPortOpen(3001)) return "http://localhost:3001";
  if (isPortOpen(3000)) return "http://localhost:3000";
  return "http://localhost:3001";
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  use: {
    baseURL: resolveBaseUrl(),
    trace: "on-first-retry",
  },
  projects: [
    { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"] } },
    { name: "Mobile Safari", use: { ...devices["iPhone 14"] } },
  ],
});
