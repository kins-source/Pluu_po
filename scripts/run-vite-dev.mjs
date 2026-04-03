import { spawn } from "node:child_process";
import http from "node:http";

const args = process.argv.slice(2);
const shouldReuse = args.includes("--reuse");
const viteArgs = args.filter((arg) => arg !== "--reuse");
const port = 1420;

async function probeViteServer(host) {
  return new Promise((resolve) => {
    const request = http.get(
      {
        host,
        port,
        path: "/",
        timeout: 1500,
      },
      (response) => {
        let body = "";

        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
          if (body.length > 4096) {
            response.destroy();
            resolve(body.includes("/@vite/client"));
          }
        });
        response.on("end", () => resolve(body.includes("/@vite/client")));
      },
    );

    request.on("timeout", () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

function runVite() {
  const child = spawn(process.execPath, ["node_modules/vite/bin/vite.js", ...viteArgs], {
    cwd: process.cwd(),
    stdio: "inherit",
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

const viteAlreadyRunning =
  (await probeViteServer("localhost")) || (await probeViteServer("127.0.0.1"));

if (viteAlreadyRunning) {
  const message =
    "Port 1420 already has a Vite dev server for this project. " +
    (shouldReuse
      ? "Reusing the existing server for Tauri."
      : "Reuse that session or stop the old `npm run dev` / `npm run tauri dev` process before starting another one.");

  console.log(message);
  process.exit(shouldReuse ? 0 : 1);
}

runVite();
