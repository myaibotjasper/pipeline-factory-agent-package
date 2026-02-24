# GitHub Actions → Canonical Event Mapping

## Priority order
1) Use `workflow_run` for Actions start/complete and durations (best for CI timelines).
2) Use `check_suite` / `check_run` for PR gating (pass/fail) when present.
3) Use `push` + `pull_request` for build inputs and PR lifecycle.

---

# 1) workflow_run (Actions)

### When a workflow run is requested or in progress
Map to: CI_STARTED
- station_hint: QA_GATE
- entity.kind: pull_request IF the workflow_run links to a PR; else commit_batch
- meta.workflow: workflow name
- meta.branch: head_branch
- meta.run_id: workflow_run.id
- meta.url: workflow_run.html_url

### When a workflow run is completed
Map to: CI_COMPLETED
- status:
  - success if conclusion == "success"
  - failure if conclusion in ("failure","cancelled","timed_out","action_required","startup_failure")
  - warning if conclusion == "neutral" or "skipped" (optional)
- meta.duration_ms: completed_at - run_started_at

Notes:
- Some runs aren't tied to a PR (e.g., on push to main). Still animate QA gate, but module may be a "commit module" instead of PR module.

---

# 2) check_suite (broad CI gate)

### check_suite created / requested / rerequested
Map to: CI_STARTED

### check_suite completed
Map to: CI_COMPLETED
- status success/failure based on conclusion

Notes:
- check_suite is often what you want to drive the “QA Gate” pass/fail.
- If both workflow_run and check_suite fire, de-dupe by sha + time window.

---

# 3) check_run (granular)

Optional use:
- Use check_run completed to show sub-checks (lint/test/build) as mini lights.
- Do not spam animations; aggregate within 1–2 seconds.

---

# 4) pull_request (lifecycle)

pull_request opened → PR_OPENED (BLUEPRINT_LOFT)
pull_request ready_for_review/reopened/synchronize/edited → PR_UPDATED (BLUEPRINT_LOFT)
pull_request closed:
- merged == true → PR_CLOSED status=success (LAUNCH_BAY optional “module shipped”)
- merged == false → PR_CLOSED status=info (recycle module)

---

# 5) push

push → CODE_PUSHED (RECEIVING_DOCK then ASSEMBLY_LINE burst)
- meta.commit_count: commits.length
- meta.branch: ref
- If matches an open PR branch: apply to that PR module as “parts burst”.

---

# 6) release

release published → RELEASE_PUBLISHED (LAUNCH_BAY)
- entity.kind: release
- entity.key: tag_name
- entity.title: release name
- meta.url: html_url
