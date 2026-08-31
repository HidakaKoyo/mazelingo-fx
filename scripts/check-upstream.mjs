/* eslint-disable typescript/no-unsafe-argument, typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return, typescript/strict-boolean-expressions, typescript/no-base-to-string, eslint/preserve-caught-error -- This Node script validates JSON and command output at runtime; oxlint has no Node type metadata for this JavaScript file. */
import { execFile as execFileCallback } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);
const DEFAULT_STATE_PATH = "docs/upstream-state.json";
const COMMIT_PATTERN = /^[0-9a-f]{7,64}$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/u;
const REPOSITORY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*\/[A-Za-z0-9][A-Za-z0-9._-]*$/u;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

export function parseArguments(argv) {
  const options = { statePath: DEFAULT_STATE_PATH };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--state") {
      const statePath = argv[index + 1];
      assert(statePath && !statePath.startsWith("-"), "--state requires a path");
      options.statePath = statePath;
      index += 1;
      continue;
    }
    if (argument === "--help") {
      options.help = true;
      continue;
    }
    if (argument === "--fetch") {
      options.fetch = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }

  return options;
}

export function validateState(state) {
  const upstream = state?.upstream;
  assert(upstream && typeof upstream === "object", "State must define an upstream object");
  assert(
    typeof upstream.repository === "string" && REPOSITORY_PATTERN.test(upstream.repository),
    "State upstream.repository must be an owner/repository string",
  );
  const remote = upstream.remote ?? "upstream";
  assert(
    typeof remote === "string" && NAME_PATTERN.test(remote),
    "State upstream.remote must be a git remote name",
  );
  assert(
    typeof upstream.branch === "string" && NAME_PATTERN.test(upstream.branch),
    "State upstream.branch must be a branch name without slashes",
  );
  assert(
    typeof upstream.lastMergedCommit === "string" && COMMIT_PATTERN.test(upstream.lastMergedCommit),
    "State upstream.lastMergedCommit must be a Git commit SHA",
  );
  assert(
    typeof upstream.lastReviewedCommit === "string" &&
      COMMIT_PATTERN.test(upstream.lastReviewedCommit),
    "State upstream.lastReviewedCommit must be a Git commit SHA",
  );
  assert(
    typeof upstream.lastReviewedAt === "string" && DATE_PATTERN.test(upstream.lastReviewedAt),
    "State upstream.lastReviewedAt must be an ISO date",
  );
  return { ...upstream, remote };
}

export async function readUpstreamState(statePath) {
  let source;
  try {
    source = await readFile(statePath, "utf8");
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      throw new Error(`Upstream state file is missing: ${statePath}`);
    }
    throw error;
  }

  let state;
  try {
    state = JSON.parse(source);
  } catch {
    throw new Error(`Upstream state file is not valid JSON: ${statePath}`);
  }
  return validateState(state);
}

async function git(args) {
  try {
    const { stdout } = await execFile("git", args, { encoding: "utf8" });
    return stdout.trim();
  } catch (error) {
    const detail = error && typeof error === "object" && "stderr" in error ? error.stderr : "";
    throw new Error(`git ${args.join(" ")} failed${detail ? `: ${String(detail).trim()}` : ""}`);
  }
}

export function matchesRepositoryUrl(url, repository) {
  const normalized = url.replace(/\/+$/u, "");
  return [
    `https://github.com/${repository}`,
    `https://github.com/${repository}.git`,
    `git@github.com:${repository}.git`,
    `ssh://git@github.com/${repository}.git`,
  ].includes(normalized);
}

export async function fetchConfiguredUpstream(upstream) {
  const expectedUrl = `https://github.com/${upstream.repository}.git`;
  let remoteUrl;
  try {
    remoteUrl = await git(["remote", "get-url", upstream.remote]);
  } catch {
    await git(["remote", "add", upstream.remote, expectedUrl]);
    remoteUrl = expectedUrl;
  }
  assert(
    matchesRepositoryUrl(remoteUrl, upstream.repository),
    `Remote ${upstream.remote} does not point to ${upstream.repository}`,
  );
  await git(["fetch", "--no-tags", upstream.remote, upstream.branch]);
}

export async function collectUpstreamStatus(upstream) {
  const upstreamRef = `${upstream.remote}/${upstream.branch}`;
  const latestCommit = await git(["rev-parse", upstreamRef]);
  assert(
    COMMIT_PATTERN.test(latestCommit),
    `Git returned an invalid commit SHA for ${upstreamRef}`,
  );

  const baselines = [upstream.lastMergedCommit, upstream.lastReviewedCommit];
  await Promise.all(
    baselines.map(async (baseline) => {
      try {
        await execFile("git", ["merge-base", "--is-ancestor", baseline, upstreamRef]);
      } catch {
        throw new Error(
          `Configured baseline ${baseline} is not an ancestor of ${upstreamRef}; update docs/upstream-state.json after reviewing the history.`,
        );
      }
    }),
  );
  try {
    await execFile("git", [
      "merge-base",
      "--is-ancestor",
      upstream.lastMergedCommit,
      upstream.lastReviewedCommit,
    ]);
  } catch {
    throw new Error(
      "State lastMergedCommit must be an ancestor of lastReviewedCommit on upstream history.",
    );
  }

  const commitsSinceReview = await git([
    "rev-list",
    "--count",
    `${upstream.lastReviewedCommit}..${upstreamRef}`,
  ]);
  assert(/^\d+$/u.test(commitsSinceReview), "Git returned an invalid upstream commit count");

  return {
    ...upstream,
    upstreamRef,
    latestCommit,
    commitsSinceReview: Number(commitsSinceReview),
  };
}

export function renderSummary(status) {
  const action =
    status.commitsSinceReview === 0
      ? "No upstream commits pending review."
      : "Review upstream changes before deciding whether to port them.";
  const integrationNote =
    status.lastMergedCommit === status.lastReviewedCommit
      ? undefined
      : "Some reviewed upstream changes are not fully integrated; see the recorded sync pull request.";
  return [
    "## Upstream watch",
    "",
    `- Upstream: \`${status.repository}\` (\`${status.upstreamRef}\`)`,
    `- Last integrated upstream commit: \`${status.lastMergedCommit}\``,
    `- Last reviewed upstream commit: \`${status.lastReviewedCommit}\` (${status.lastReviewedAt})`,
    `- Current upstream commit: \`${status.latestCommit}\``,
    `- Commits pending review: **${status.commitsSinceReview}**`,
    "",
    action,
    ...(integrationNote === undefined ? [] : ["", integrationNote]),
    "",
  ].join("\n");
}

export function renderOutputs(status) {
  return [
    `upstream_repository=${status.repository}`,
    `latest_commit=${status.latestCommit}`,
    `last_reviewed_commit=${status.lastReviewedCommit}`,
    `commits_pending_review=${status.commitsSinceReview}`,
    `has_pending_review=${String(status.commitsSinceReview > 0)}`,
    "",
  ].join("\n");
}

async function writeSummary(summary) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    await appendFile(summaryPath, summary, "utf8");
  }
}

async function writeOutputs(status) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    await appendFile(outputPath, renderOutputs(status), "utf8");
  }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  if (options.help) {
    console.log("Usage: node scripts/check-upstream.mjs [--fetch] [--state <path>]");
    return;
  }

  const upstream = await readUpstreamState(resolve(options.statePath));
  if (options.fetch) {
    await fetchConfiguredUpstream(upstream);
  }
  const status = await collectUpstreamStatus(upstream);
  const summary = renderSummary(status);
  await writeSummary(summary);
  await writeOutputs(status);
  process.stdout.write(summary);
}

if (import.meta.url === pathToFileURL(resolve(process.argv[1] ?? "")).href) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
