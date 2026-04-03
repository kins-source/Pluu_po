import { spawn, execFileSync } from "node:child_process";

const repoPath = process.cwd();
const args = process.argv.slice(2);
const isDevCommand = args[0] === "dev";

function listCommands() {
  try {
    if (process.platform === "win32") {
      const output = execFileSync(
        "powershell.exe",
        [
          "-NoProfile",
          "-Command",
          "Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'node.exe' } | Select-Object ProcessId, CommandLine | ConvertTo-Json -Compress",
        ],
        { encoding: "utf8" },
      );
      const parsed = JSON.parse(output || "[]");

      return Array.isArray(parsed) ? parsed : [parsed];
    }

    const output = execFileSync("ps", ["-ax", "-o", "pid=", "-o", "command="], {
      encoding: "utf8",
    });

    return output
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(.*)$/);
        return match
          ? { ProcessId: Number(match[1]), CommandLine: match[2] }
          : null;
      })
      .filter(Boolean);
  } catch {
    return [];
  }
}

function hasExistingTauriDev() {
  const commands = listCommands().filter(
    (processInfo) => processInfo.ProcessId !== process.pid,
  );

  return commands.find((processInfo) => {
    const commandLine = processInfo.CommandLine || "";
    const lower = commandLine.toLowerCase();

    return (
      lower.includes(repoPath.toLowerCase()) &&
      (lower.includes("scripts/run-tauri-cli.mjs\" dev") ||
        lower.includes("scripts/run-tauri-cli.mjs dev") ||
        lower.includes("@tauri-apps\\cli\\tauri.js\" dev") ||
        lower.includes("@tauri-apps\\cli\\tauri.js dev") ||
        lower.includes("@tauri-apps/cli/tauri.js\" dev"))
    );
  });
}

if (isDevCommand) {
  const existingProcess = hasExistingTauriDev();

  if (existingProcess) {
    console.error(
      [
        "Another `tauri dev` session for this repo is already running.",
        `Existing PID: ${existingProcess.ProcessId}.`,
        "Starting a second one is what triggers the Vite port 1420 collision and can lead to Cargo waiting on the package-cache lock.",
        "Stop the old dev session first, or reuse the one that is already running.",
      ].join(" "),
    );
    process.exit(1);
  }
}

const child = spawn(
  process.platform === "win32" ? "node.exe" : "node",
  ["node_modules/@tauri-apps/cli/tauri.js", ...args],
  {
    cwd: process.cwd(),
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
