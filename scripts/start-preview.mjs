import { spawn } from "node:child_process";

const port = process.env.PORT ?? "4173";

const child = spawn(
  process.execPath,
  [
    "./node_modules/vite/bin/vite.js",
    "preview",
    "--host",
    "0.0.0.0",
    "--port",
    port,
  ],
  {
    stdio: "inherit",
    env: process.env,
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
