/* eslint-disable typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return -- node:test imports lack type metadata in this JavaScript test. */
import assert from "node:assert/strict";
import test from "node:test";

import {
  matchesRepositoryUrl,
  parseArguments,
  renderOutputs,
  renderSummary,
  validateState,
} from "./check-upstream.mjs";

const validState = {
  upstream: {
    branch: "main",
    lastMergedCommit: "161132c55646b27560de8a5f2d4f4e4d8eb83e58",
    lastReviewedAt: "2026-08-31",
    lastReviewedCommit: "161132c55646b27560de8a5f2d4f4e4d8eb83e58",
    repository: "Yeq6X/mazelingo",
  },
};

test("parses the fetch option and an alternate state path", () => {
  assert.deepEqual(parseArguments(["--fetch", "--state", "tmp/upstream.json"]), {
    fetch: true,
    statePath: "tmp/upstream.json",
  });
});

test("requires an owner/repository and review date in upstream state", () => {
  assert.deepEqual(validateState(validState), { ...validState.upstream, remote: "upstream" });
  assert.throws(
    () => validateState({ upstream: { ...validState.upstream, repository: "not a repository" } }),
    /owner\/repository/u,
  );
  assert.throws(
    () => validateState({ upstream: { ...validState.upstream, lastReviewedAt: "August 31" } }),
    /ISO date/u,
  );
});

test("accepts only the configured GitHub remote URL", () => {
  assert.equal(
    matchesRepositoryUrl("https://github.com/Yeq6X/mazelingo.git", "Yeq6X/mazelingo"),
    true,
  );
  assert.equal(matchesRepositoryUrl("git@github.com:Yeq6X/mazelingo.git", "Yeq6X/mazelingo"), true);
  assert.equal(
    matchesRepositoryUrl("https://evil.example/Yeq6X/mazelingo.git", "Yeq6X/mazelingo"),
    false,
  );
});

test("renders an explicit pending-review status for Actions", () => {
  const status = {
    ...validState.upstream,
    commitsSinceReview: 2,
    latestCommit: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    remote: "upstream",
    upstreamRef: "upstream/main",
  };
  assert.match(renderSummary(status), /Commits pending review: \*\*2\*\*/u);
  assert.match(renderOutputs(status), /commits_pending_review=2/u);
  assert.match(renderOutputs(status), /has_pending_review=true/u);
});
