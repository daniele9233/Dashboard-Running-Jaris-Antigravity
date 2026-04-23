import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

type ApiRoute = {
  method: string;
  path: string;
  handler: string;
  file: string;
  line: number;
};

type FrontendRoute = {
  path: string;
  element: string;
  file: string;
  line: number;
};

type ApiClient = {
  name: string;
  method: string;
  path: string;
  file: string;
};

type RepoFile = {
  path: string;
  kind: string;
  purpose: string;
  touch_when: string[];
  exports: string[];
  routes: string[];
  imports: string[];
  hash: string;
  last_modified: string;
  size_bytes: number;
};

type RepoMap = {
  version: number;
  generated_at: string;
  project: {
    name: string;
    stack: string[];
  };
  counts: {
    files: number;
    backend_routes: number;
    frontend_routes: number;
    api_clients: number;
  };
  files: RepoFile[];
  api_routes: ApiRoute[];
  frontend_routes: FrontendRoute[];
  api_clients: ApiClient[];
};

const root = process.cwd();
const checkMode = process.argv.includes("--check");

const generatedFiles = new Set(["repo-map.md", "repo-map.json"]);
const includeEntries = [
  "src",
  "backend",
  "docs",
  "public",
  "local-whisper",
  "restyling/src",
  "scripts",
  ".githooks",
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "render.yaml",
  "index.html",
  "metadata.json",
  "README.md",
  "PRD.md",
  "llms.txt",
  ".ai-context.md",
  "CHANGELOG-AI.md",
];

const excludedDirs = new Set([
  ".git",
  ".vite",
  ".cache",
  "__pycache__",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
]);

const excludedFileNames = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "backend-local.log",
  "backend-local.err.log",
  "vite-dev.log",
  "vite-dev.err.log",
  "vite-local-3001.log",
  "vite-local-3001.err.log",
]);

const excludedExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".mp4",
  ".mov",
  ".zip",
  ".fit",
  ".sqlite",
  ".db",
  ".log",
]);

function rel(filePath: string): string {
  return path.relative(root, filePath).replaceAll(path.sep, "/");
}

function stableRead(filePath: string): string {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function shouldExclude(filePath: string): boolean {
  const relative = rel(filePath);
  const parts = relative.split("/");
  if (parts.some((part) => excludedDirs.has(part))) return true;
  const base = path.basename(filePath);
  if (generatedFiles.has(relative)) return true;
  if (excludedFileNames.has(base)) return true;
  if (base.startsWith(".env")) return true;
  if (relative.includes(".env")) return true;
  if (relative.includes("/.claude/settings.local.json")) return true;
  if (relative.includes("/browser-tools-mcp/")) return true;
  return excludedExtensions.has(path.extname(base).toLowerCase());
}

function collectFiles(entry: string): string[] {
  const abs = path.join(root, entry);
  if (!existsSync(abs) || shouldExclude(abs)) return [];
  const stat = statSync(abs);
  if (stat.isFile()) return [abs];
  if (!stat.isDirectory()) return [];
  const output: string[] = [];
  const stack = [abs];
  while (stack.length) {
    const current = stack.pop()!;
    if (shouldExclude(current)) continue;
    for (const dirent of readdirSync(current, { withFileTypes: true })) {
      const next = path.join(current, dirent.name);
      if (shouldExclude(next)) continue;
      if (dirent.isDirectory()) stack.push(next);
      if (dirent.isFile()) output.push(next);
    }
  }
  return output;
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
}

function firstHeading(content: string): string | null {
  const match = content.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function extractImports(content: string): string[] {
  const imports: string[] = [];
  for (const match of content.matchAll(/^\s*import(?:\s+type)?[\s\S]*?\sfrom\s+["']([^"']+)["'];?/gm)) {
    imports.push(match[1]);
  }
  for (const match of content.matchAll(/^\s*from\s+([a-zA-Z0-9_\.]+)\s+import\s+/gm)) {
    imports.push(match[1]);
  }
  return uniq(imports).slice(0, 40);
}

function extractExports(content: string, relative: string): string[] {
  const exports: string[] = [];
  for (const match of content.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function|const|class|interface|type|enum)\s+([A-Za-z0-9_]+)/g)) {
    exports.push(match[1]);
  }
  for (const match of content.matchAll(/^def\s+([A-Za-z0-9_]+)\s*\(/gm)) {
    if (relative.endsWith(".py")) exports.push(match[1]);
  }
  for (const match of content.matchAll(/^async\s+def\s+([A-Za-z0-9_]+)\s*\(/gm)) {
    if (relative.endsWith(".py")) exports.push(match[1]);
  }
  return uniq(exports).slice(0, 60);
}

function extractBackendRoutes(content: string, relative: string): ApiRoute[] {
  if (!relative.endsWith("backend/server.py")) return [];
  const lines = content.split("\n");
  const routes: ApiRoute[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const routeMatch = lines[i].match(/@app\.(get|post|patch|put|delete)\(\s*["']([^"']+)["']/);
    if (!routeMatch) continue;
    let handler = "unknown";
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j += 1) {
      const fnMatch = lines[j].match(/(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/);
      if (fnMatch) {
        handler = fnMatch[1];
        break;
      }
    }
    routes.push({
      method: routeMatch[1].toUpperCase(),
      path: routeMatch[2],
      handler,
      file: relative,
      line: i + 1,
    });
  }
  return routes.sort((a, b) => `${a.path}:${a.method}`.localeCompare(`${b.path}:${b.method}`));
}

function extractFrontendRoutes(content: string, relative: string): FrontendRoute[] {
  if (!relative.endsWith("src/App.tsx")) return [];
  const lines = content.split("\n");
  const routes: FrontendRoute[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = lines[i].match(/<Route\s+path=["']([^"']+)["'][^>]*element=\{<([A-Za-z0-9_]+)/);
    if (!match) continue;
    routes.push({
      path: match[1],
      element: match[2],
      file: relative,
      line: i + 1,
    });
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path));
}

function extractApiClients(content: string, relative: string): ApiClient[] {
  if (!relative.endsWith("src/api/index.ts")) return [];
  const blocks = content.split(/(?=export\s+const\s+[A-Za-z0-9_]+\s*=)/g);
  const clients: ApiClient[] = [];
  for (const block of blocks) {
    const nameMatch = block.match(/export\s+const\s+([A-Za-z0-9_]+)\s*=/);
    if (!nameMatch) continue;
    const apiMatch = block.match(/api\.(get|post|patch|put|delete)(?:<[\s\S]*?>)?\(\s*([`"'])([^`"']+)/);
    if (!apiMatch) continue;
    clients.push({
      name: nameMatch[1],
      method: apiMatch[1].toUpperCase(),
      path: apiMatch[3],
      file: relative,
    });
  }
  return clients.sort((a, b) => a.name.localeCompare(b.name));
}

function kindFor(relative: string): string {
  const base = path.basename(relative);
  if (relative === "backend/server.py") return "backend-monolith";
  if (relative.startsWith("backend/") && relative.endsWith(".py")) return "backend-script";
  if (relative === "src/App.tsx") return "frontend-router";
  if (relative === "src/api/index.ts") return "frontend-api-client";
  if (relative === "src/api/client.ts") return "frontend-api-core";
  if (relative.startsWith("src/types/")) return "frontend-types";
  if (relative.startsWith("src/components/statistics/")) return "frontend-statistics-component";
  if (relative.startsWith("src/components/runner-dna/")) return "frontend-runner-dna-component";
  if (relative.startsWith("src/components/") && base.endsWith("View.tsx")) return "frontend-view";
  if (relative.startsWith("src/components/")) return "frontend-component";
  if (relative.startsWith("src/hooks/")) return "frontend-hook";
  if (relative.startsWith("src/utils/")) return "frontend-utility";
  if (relative.startsWith("src/context/")) return "frontend-context";
  if (relative.startsWith("src/i18n/")) return "frontend-i18n";
  if (relative.startsWith("src/")) return "frontend-source";
  if (relative.startsWith("docs/")) return "documentation";
  if (relative.startsWith("scripts/")) return "tooling-script";
  if (relative.startsWith("public/")) return "public-asset";
  if (relative.startsWith("local-whisper/")) return "local-ai-service";
  if (relative.startsWith("restyling/")) return "legacy-restyling-source";
  if (relative.endsWith(".md") || relative.endsWith(".txt")) return "documentation";
  if (relative.endsWith(".json")) return "config";
  if (relative.endsWith(".ts")) return "config-or-tooling";
  return "project-file";
}

function touchTags(relative: string, content: string): string[] {
  const hay = `${relative}\n${content}`.toLowerCase();
  const tags: string[] = [];
  const rules: Array<[string, RegExp]> = [
    ["dashboard", /dashboard|status forma|peak score|widget/],
    ["activities", /activities|routesview|runs|run detail|telemetry|splits/],
    ["training", /training|training-plan|piano|calendar|session|vdot_progression/],
    ["runner-dna", /runner[-_ ]dna|dna_scores|running_dynamics/],
    ["garmin", /garmin|csv|gct|ground contact|vertical|stride/],
    ["cadence", /cadence|cadenza|avg_cadence/],
    ["statistics", /statistics|analytics|chart|stats|biomechanics/],
    ["profile", /profile|profilo/],
    ["strava", /strava|oauth|polyline/],
    ["api", /\/api\/|api\.|fastapi|endpoint/],
    ["types", /interface|type |types\//],
    ["layout", /layout|sidebar|topbar|grid/],
    ["map", /mapbox|maplibre|react-map-gl|latlng|start_latlng/],
    ["ai", /ai|jarvis|claude|gemini|coach/],
    ["context-pack", /llms|repo-map|ai-context|context:update/],
  ];
  for (const [tag, regex] of rules) {
    if (regex.test(hay)) tags.push(tag);
  }
  return uniq(tags).slice(0, 12);
}

function purposeFor(relative: string, kind: string, content: string, exports: string[], routes: string[]): string {
  if (relative === "backend/server.py") return "FastAPI backend monolith: Strava/Garmin sync, dashboard, analytics, training plan, Runner DNA and AI endpoints.";
  if (relative === "src/App.tsx") return "React app shell with providers, top navigation and frontend route declarations.";
  if (relative === "src/api/index.ts") return "Typed frontend API wrappers for backend endpoints.";
  if (relative === "src/api/client.ts") return "Fetch wrapper, backend base URL resolution and API error handling.";
  if (relative === "src/types/api.ts") return "Shared TypeScript contracts for API responses and domain entities.";
  if (relative === "src/utils/cadence.ts") return "Frontend cadence normalization helpers, returning canonical steps per minute.";
  if (relative === "src/utils/runnerDnaModel.ts") return "Adapter that turns real Runner DNA/profile/best-efforts data into the Runner DNA V2 UI model.";
  if (relative === "src/hooks/useRunnerDnaUiModel.ts") return "Hook that loads Runner DNA, profile and best efforts, handles cache clearing and builds the V2 UI model.";
  if (relative.endsWith(".md") || relative.endsWith(".txt")) return firstHeading(content) ?? "Project documentation.";
  if (kind === "frontend-view") return `Page/view component for ${path.basename(relative, ".tsx").replace(/View$/, "")}.`;
  if (kind === "frontend-component" || kind === "frontend-statistics-component" || kind === "frontend-runner-dna-component") return `React component ${path.basename(relative, path.extname(relative))}.`;
  if (kind === "frontend-hook") return `React hook exporting ${exports.join(", ") || path.basename(relative, path.extname(relative))}.`;
  if (kind === "frontend-utility") return `Shared utility module exporting ${exports.slice(0, 4).join(", ") || path.basename(relative, path.extname(relative))}.`;
  if (kind === "frontend-types") return `TypeScript type module exporting ${exports.slice(0, 6).join(", ") || "domain types"}.`;
  if (routes.length) return `Route/API-bearing file with ${routes.length} route(s).`;
  if (kind === "backend-script") return `Backend helper or diagnostic script ${path.basename(relative)}.`;
  if (kind === "tooling-script") return `Project tooling script ${path.basename(relative)}.`;
  if (kind === "config") return `Project configuration file ${path.basename(relative)}.`;
  return `${kind} ${path.basename(relative)}.`;
}

function routesForFile(relative: string, backendRoutes: ApiRoute[], frontendRoutes: FrontendRoute[], apiClients: ApiClient[]): string[] {
  const values = [
    ...backendRoutes.filter((route) => route.file === relative).map((route) => `${route.method} ${route.path}`),
    ...frontendRoutes.filter((route) => route.file === relative).map((route) => route.path),
    ...apiClients.filter((client) => client.file === relative).map((client) => `${client.method} ${client.path}`),
  ];
  return uniq(values);
}

function buildRepoMap(): RepoMap {
  const files = uniq(includeEntries.flatMap(collectFiles)).sort((a, b) => rel(a).localeCompare(rel(b)));
  const contents = new Map<string, string>();
  const stats = new Map<string, { mtimeMs: number; mtime: Date; size: number }>();
  for (const file of files) {
    contents.set(file, stableRead(file));
    const stat = statSync(file);
    stats.set(file, {
      mtimeMs: Number(stat.mtimeMs),
      mtime: stat.mtime,
      size: Number(stat.size),
    });
  }

  const backendRoutes = files.flatMap((file) => extractBackendRoutes(contents.get(file)!, rel(file)));
  const frontendRoutes = files.flatMap((file) => extractFrontendRoutes(contents.get(file)!, rel(file)));
  const apiClients = files.flatMap((file) => extractApiClients(contents.get(file)!, rel(file)));
  const latestMtime = files.reduce((latest, file) => Math.max(latest, stats.get(file)!.mtimeMs), 0);
  const generatedAt = new Date(latestMtime || 0).toISOString();

  const repoFiles: RepoFile[] = files.map((file) => {
    const relative = rel(file);
    const content = contents.get(file)!;
    const kind = kindFor(relative);
    const exports = extractExports(content, relative);
    const imports = extractImports(content);
    const routes = routesForFile(relative, backendRoutes, frontendRoutes, apiClients);
    return {
      path: relative,
      kind,
      purpose: purposeFor(relative, kind, content, exports, routes),
      touch_when: touchTags(relative, content),
      exports,
      routes,
      imports,
      hash: hashContent(content),
      last_modified: stats.get(file)!.mtime.toISOString(),
      size_bytes: stats.get(file)!.size,
    };
  });

  return {
    version: 1,
    generated_at: generatedAt,
    project: {
      name: "webapp-antiG",
      stack: ["React", "Vite", "TypeScript", "FastAPI", "MongoDB", "Mapbox", "Recharts"],
    },
    counts: {
      files: repoFiles.length,
      backend_routes: backendRoutes.length,
      frontend_routes: frontendRoutes.length,
      api_clients: apiClients.length,
    },
    files: repoFiles,
    api_routes: backendRoutes,
    frontend_routes: frontendRoutes,
    api_clients: apiClients,
  };
}

function mdEscape(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\n/g, " ");
}

function renderRepoMapMd(map: RepoMap): string {
  const byTag = new Map<string, string[]>();
  for (const file of map.files) {
    for (const tag of file.touch_when) {
      const list = byTag.get(tag) ?? [];
      list.push(file.path);
      byTag.set(tag, list);
    }
  }

  const kindGroups = new Map<string, RepoFile[]>();
  for (const file of map.files) {
    const group = kindGroups.get(file.kind) ?? [];
    group.push(file);
    kindGroups.set(file.kind, group);
  }

  const lines: string[] = [];
  lines.push("# Repository Map");
  lines.push("");
  lines.push("> Generated by `npm run context:update`. Do not edit by hand.");
  lines.push("");
  lines.push(`Generated at: \`${map.generated_at}\``);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Project: \`${map.project.name}\``);
  lines.push(`- Stack: ${map.project.stack.map((item) => `\`${item}\``).join(", ")}`);
  lines.push(`- Files indexed: ${map.counts.files}`);
  lines.push(`- Backend routes: ${map.counts.backend_routes}`);
  lines.push(`- Frontend routes: ${map.counts.frontend_routes}`);
  lines.push(`- Frontend API clients: ${map.counts.api_clients}`);
  lines.push("");
  lines.push("## How To Use This Map");
  lines.push("");
  lines.push("1. Start with `llms.txt` and `.ai-context.md`.");
  lines.push("2. Find the relevant tag in `Where To Touch`.");
  lines.push("3. Open only the listed source files and adjacent types/API wrappers.");
  lines.push("4. After meaningful changes, run `npm run context:update`.");
  lines.push("");

  lines.push("## Where To Touch");
  lines.push("");
  for (const tag of Array.from(byTag.keys()).sort()) {
    const paths = uniq(byTag.get(tag)!).slice(0, 14);
    lines.push(`### ${tag}`);
    lines.push("");
    for (const file of paths) lines.push(`- \`${file}\``);
    lines.push("");
  }

  lines.push("## Frontend Routes");
  lines.push("");
  lines.push("| Path | Element | File |");
  lines.push("|---|---|---|");
  for (const route of map.frontend_routes) {
    lines.push(`| \`${mdEscape(route.path)}\` | \`${mdEscape(route.element)}\` | \`${route.file}:${route.line}\` |`);
  }
  lines.push("");

  lines.push("## Backend API Routes");
  lines.push("");
  lines.push("| Method | Path | Handler | File |");
  lines.push("|---|---|---|---|");
  for (const route of map.api_routes) {
    lines.push(`| ${route.method} | \`${mdEscape(route.path)}\` | \`${route.handler}\` | \`${route.file}:${route.line}\` |`);
  }
  lines.push("");

  lines.push("## Frontend API Client");
  lines.push("");
  lines.push("| Function | Method | Path |");
  lines.push("|---|---|---|");
  for (const client of map.api_clients) {
    lines.push(`| \`${client.name}\` | ${client.method} | \`${mdEscape(client.path)}\` |`);
  }
  lines.push("");

  lines.push("## Files");
  lines.push("");
  for (const kind of Array.from(kindGroups.keys()).sort()) {
    lines.push(`### ${kind}`);
    lines.push("");
    lines.push("| Path | Purpose | Touch When | Exports | Routes/API |");
    lines.push("|---|---|---|---|---|");
    for (const file of kindGroups.get(kind)!.sort((a, b) => a.path.localeCompare(b.path))) {
      const exports = file.exports.slice(0, 8).map((item) => `\`${item}\``).join(", ");
      const routes = file.routes.slice(0, 6).map((item) => `\`${mdEscape(item)}\``).join(", ");
      lines.push(
        `| \`${file.path}\` | ${mdEscape(file.purpose)} | ${file.touch_when.join(", ") || "-"} | ${exports || "-"} | ${routes || "-"} |`,
      );
    }
    lines.push("");
  }

  lines.push("## Safety");
  lines.push("");
  lines.push("- `.env`, `.env.local`, `backend/.env`, logs, build output, package locks and heavy binary assets are excluded.");
  lines.push("- `repo-map.json` contains hashes and metadata, not source code bodies.");
  lines.push("- If a generated map looks stale, run `npm run context:update`.");
  lines.push("");
  return `${lines.join("\n")}\n`;
}

function writeOrCheck(filePath: string, content: string): boolean {
  const abs = path.join(root, filePath);
  const existing = existsSync(abs) ? stableRead(abs) : null;
  if (existing === content) return true;
  if (checkMode) {
    console.error(`${filePath} is not up to date. Run npm run context:update.`);
    return false;
  }
  writeFileSync(abs, content, "utf8");
  console.log(`updated ${filePath}`);
  return true;
}

function main() {
  if (!existsSync(path.join(root, "scripts"))) {
    mkdirSync(path.join(root, "scripts"));
  }
  const map = buildRepoMap();
  const json = `${JSON.stringify(map, null, 2)}\n`;
  const markdown = renderRepoMapMd(map);
  const okJson = writeOrCheck("repo-map.json", json);
  const okMd = writeOrCheck("repo-map.md", markdown);
  if (!okJson || !okMd) process.exitCode = 1;
  if (okJson && okMd && checkMode) {
    console.log("AI context map is up to date.");
  }
}

main();
