import { spawn } from "node:child_process";
import path from "node:path";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// One run at a time per server (the ETL also takes a database lock).
let running = false;

function pythonCommand(): { cmd: string; args: string[] } {
  if (process.env.PYTHON_BIN) return { cmd: process.env.PYTHON_BIN, args: [] };
  return process.platform === "win32" ? { cmd: "py", args: ["-3"] } : { cmd: "python3", args: [] };
}

const line = (o: object) => JSON.stringify(o) + "\n";

/** Runs warehouse/etl/etl.py and streams its JSON events to the browser as they happen. */
export async function POST() {
  const session = await getSession();
  if (!session) return new Response(line({ type: "error", message: "Sign in first." }), { status: 401 });
  if (running) return new Response(line({ type: "error", message: "An ETL run is already in progress." }), { status: 409 });
  running = true;

  const { cmd, args } = pythonCommand();
  const script = path.join(process.cwd(), "warehouse", "etl", "etl.py");
  const child = spawn(/*turbopackIgnore: true*/ cmd, [...args, script, "--json", "--triggered-by", `dashboard (${session.username})`], {
    cwd: process.cwd(),
    env: { ...process.env, PYTHONIOENCODING: "utf-8", PYTHONUNBUFFERED: "1" },
  });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      let buffer = "";
      let stderr = "";
      let finished = false;
      const send = (text: string) => controller.enqueue(encoder.encode(text.endsWith("\n") ? text : text + "\n"));
      child.stdout.on("data", (chunk: Buffer) => {
        buffer += chunk.toString("utf8");
        let i: number;
        while ((i = buffer.indexOf("\n")) >= 0) {
          const text = buffer.slice(0, i).trim();
          buffer = buffer.slice(i + 1);
          if (!text) continue;
          if (text.includes('"type": "summary"') || text.includes('"type": "error"')) finished = true;
          send(text);
        }
      });
      child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString("utf8"); });
      child.on("error", (err) => {
        finished = true;
        send(line({ type: "error", message: `Could not start Python (${cmd}): ${err.message}. Run npm start once to set it up.` }));
      });
      child.on("close", (code) => {
        if (buffer.trim()) send(buffer.trim());
        if (!finished) send(line({ type: "error", message: `The ETL stopped with exit code ${code}. ${stderr.trim().split("\n").slice(-3).join(" ")}` }));
        running = false;
        controller.close();
      });
    },
    cancel() {
      child.kill();
      running = false;
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
