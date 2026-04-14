import "dotenv/config";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ==========================
// 🔹 STEP 1: GET DIFF
// ==========================
function getDiff() {
  if (fs.existsSync("diff.txt")) {
    console.log("📄 Using diff.txt");
    return fs.readFileSync("diff.txt", "utf-8");
  }

  console.log("💻 Running git diff");
  return execSync("git diff", { encoding: "utf-8" });
}

// ==========================
// 🔹 STEP 2: CHANGED FILES
// ==========================
function getChangedFiles() {
  const output = execSync("git diff --name-only", { encoding: "utf-8" });
  return output.split("\n").filter(Boolean);
}

// ==========================
// 🔹 STEP 3: BUILD FILE MAP
// ==========================
function buildFileMap(root = "./") {
  const map = {};

  function scan(dir) {
    for (const file of fs.readdirSync(dir)) {
      const full = path.join(dir, file);

      if (fs.statSync(full).isDirectory()) {
        scan(full);
      } else if (file.endsWith(".js")) {
        const content = fs.readFileSync(full, "utf-8");

        const imports = [
          ...content.matchAll(/import .* from ['"](.*)['"]/g),
        ].map((m) => m[1]);

        map[full] = { imports };
      }
    }
  }

  scan(root);
  return map;
}

// ==========================
// 🔹 STEP 4: RESOLVE IMPORTS
// ==========================
function resolveImports(file, fileMap) {
  const imports = fileMap[file]?.imports || [];

  return imports
    .map((imp) => Object.keys(fileMap).find((f) => f.includes(imp)))
    .filter(Boolean);
}

// ==========================
// 🔹 STEP 5: CONTEXT FILES
// ==========================
function getContextFiles(diffFiles, fileMap) {
  const context = new Set();

  for (const file of diffFiles) {
    context.add(file);

    const deps = resolveImports(file, fileMap);
    deps.forEach((d) => context.add(d));
  }

  return [...context];
}

// ==========================
// 🔹 STEP 6: DOMAIN ENRICHMENT
// ==========================
function enrichContext(files) {
  const extra = [];

  for (const file of files) {
    if (file.includes("scopeIdResolver")) {
      extra.push("validators/travelStep.validator.js");
    }

    if (file.includes("flight") || file.includes("distance")) {
      extra.push("constants/FLIGHT_RULES.js");
    }
  }

  return [...new Set([...files, ...extra])];
}

// ==========================
// 🔹 STEP 7: LOAD CONTEXT
// ==========================
function loadContext(files) {
  let content = "";

  for (const file of files) {
    try {
      const code = fs.readFileSync(file, "utf-8");

      // 🔥 limit file size (important for tokens)
      const trimmed =
        code.length > 3000 ? code.slice(0, 3000) + "\n// truncated" : code;

      content += `\n\n--- FILE: ${file} ---\n${trimmed}`;
    } catch {}
  }

  return content;
}

// ==========================
// 🔹 MAIN EXECUTION
// ==========================
let code = getDiff();

if (!code || code.trim().length === 0) {
  console.log("No code changes provided for review.");
  process.exit(0);
}

const changedFiles = getChangedFiles();
console.log("📂 Changed:", changedFiles);

const fileMap = buildFileMap();
const contextFiles = enrichContext(getContextFiles(changedFiles, fileMap));
console.log("🧠 Context:", contextFiles);

const contextCode = loadContext(contextFiles);
console.log(contextCode);

// ==========================
// 🔥 FINAL PROMPT
// ==========================
const prompt = `
You are a senior backend reviewer.

Assume the existing codebase is production-grade.

System Context:
- All input validation is handled via Zod at request layer
- Business logic assumes sanitized inputs
- Enums and mappings are standardized across services

Focus ONLY on:
- Bugs introduced in this diff
- Logical errors
- Edge cases NOT handled by schema
- Breaking changes

STRICT RULES:
- Do NOT flag missing validation if already handled in context
- Do NOT suggest redundant defensive coding
- Do NOT review untouched code
- Do NOT assume missing context → use provided context files

OUTPUT FORMAT (STRICT):

CRITICAL:
<file>:<line> → issue

WARNING:
<file>:<line> → issue

SUGGESTIONS:
<file>:<line> → suggestion

NOTE:
One line impact summary

----------------------
CONTEXT FILES
----------------------
${contextCode}

----------------------
GIT DIFF
----------------------
${code}
`;

// ==========================
// 🔹 CALL OPENAI
// ==========================
const res = await fetch("https://api.openai.com/v1/responses", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "gpt-5.1",
    input: prompt,
  }),
});

const data = await res.json();
console.log(data);

const text = data?.output?.[0]?.content?.[0]?.text || "No AI response received";

console.log("\n===== AI REVIEW =====\n");
console.log(text);

// ==========================
// 🔹 FORMAT HELPERS
// ==========================
function formatSection(fullText, section) {
  const regex = new RegExp(`${section}:([\\s\\S]*?)(?=\\n[A-Z]+:|$)`);
  const match = fullText.match(regex);

  if (!match || !match[1].trim()) {
    return "✅ No issues found";
  }

  return match[1]
    .trim()
    .split("\n")
    .map((l) => `- ${l.replace(/^-\s*/, "")}`)
    .join("\n");
}

// ==========================
// 🔹 FINAL COMMENT
// ==========================
const reviewComment = `
## 🤖 AI Code Review

### 🔴 CRITICAL
${formatSection(text, "CRITICAL")}

### 🟠 WARNING
${formatSection(text, "WARNING")}

### 🟢 SUGGESTIONS
${formatSection(text, "SUGGESTIONS")}

### 🔵 NOTE
${formatSection(text, "NOTE")}
`;

// ==========================
// 🔹 POST TO GITHUB
// ==========================
if (process.env.GITHUB_TOKEN && process.env.PR_NUMBER) {
  await fetch(
    `https://api.github.com/repos/${process.env.REPO}/issues/${process.env.PR_NUMBER}/comments`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ body: reviewComment }),
    },
  );

  console.log("✅ PR comment posted");
}
