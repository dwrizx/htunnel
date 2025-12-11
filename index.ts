import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { webRoutes } from "./src/routes/web";
import { apiRoutes } from "./src/routes/api";
import { tunnelManager } from "./src/tunnel-manager";
import { showHelp, parseArgs } from "./src/cli";

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  showHelp();
  process.exit(0);
}

const app = new Hono();

app.route("/", webRoutes);
app.route("/api", apiRoutes);

const PORT = args.port;

console.log(`
┌─────────────────────────────────────────┐
│  Hades Tunnel                           │
│  http://localhost:${PORT.toString().padEnd(24)}│
│                                         │
│  Providers: Pinggy, Cloudflare,         │
│             ngrok, Localtunnel          │
│                                         │
│  Help: http://localhost:${PORT}/help${" ".repeat(12 - PORT.toString().length)}│
│  CLI:  bun run index.ts --help          │
└─────────────────────────────────────────┘
`);

process.on("SIGINT", async () => {
  console.log("\nStopping all tunnels...");
  await tunnelManager.stopAll();
  console.log("Goodbye!");
  process.exit(0);
});

serve({ fetch: app.fetch, port: PORT });
