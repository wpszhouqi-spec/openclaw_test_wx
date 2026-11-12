import { spawn } from "node:child_process";
import type { RagConfig } from "./config.ts";

export async function runOpenClawAgent(
  config: RagConfig,
  message: string,
  opts: { timeoutMs?: number } = {},
): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const args = [
    config.openclawBin,
    "agent",
    "--agent",
    config.openclawAgentId,
    "--model",
    config.openclawModel,
    "--thinking",
    "off",
    "-m",
    message,
    "--timeout",
    String(Math.ceil(timeoutMs / 1000)),
  ];

  return await new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      cwd: config.openclawRoot,
      env: {
        ...process.env,
        OPENCLAW_VITEST_RUNTIME: process.env.OPENCLAW_VITEST_RUNTIME ?? "node",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`OpenClaw agent timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      const text = stdout.trim() || stderr.trim();
      if (code !== 0) {
        reject(new Error(text || `OpenClaw agent exited with code ${code}`));
        return;
      }
      resolve(text || "(empty OpenClaw response)");
    });
  });
}

export function buildRagPrompt(query: string, context: string): string {
  return [
    "你是 OpenClaw 助手。请优先依据下列知识库片段回答。",
    "若知识不足以回答，请明确说不知道，不要编造。",
    "",
    "# 知识库",
    context,
    "",
    "# 用户问题",
    query,
    "",
    "请用简洁中文回答。",
  ].join("\n");
}
