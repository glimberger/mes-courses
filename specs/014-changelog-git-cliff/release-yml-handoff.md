# Hand-off: `release.yml` change (T011)

The workflow directory is maintainer-only (`docs/agent-guardrails.md`), so this change is not part of the
branch. The maintainer applies it and merges it; until then the workflow keeps generating the notes as
today, and the "GitHub Release body" acceptance criterion (US3) stays open.

Job `publish`, step "Create the release vX.Y.Z" (the step already runs with `set -eu`, so a version
without a changelog section makes `release-notes.sh` exit 1 and fails the job before the release is
created). The job checks out the full history at the tag, so `CHANGELOG.md` is there. Checked with
`actionlint` (no finding) on a scratch copy outside the repository.

```diff
@@ -178,7 +178,9 @@
           set -eu
           dir="$RUNNER_TEMP/artifacts"
           if ! gh release view "$TAG" >/dev/null 2>&1; then
-            gh release create "$TAG" --verify-tag --title "$TAG" --generate-notes
+            # The body is the version's section of CHANGELOG.md; a missing section fails the job (set -e).
+            sh .github/scripts/release-notes.sh "${TAG#v}" > "$RUNNER_TEMP/notes.md"
+            gh release create "$TAG" --verify-tag --title "$TAG" --notes-file "$RUNNER_TEMP/notes.md"
           fi
           # The APK is attached for history, the agent bundle for the Pi (quickstart §7).
           gh release upload "$TAG" --clobber \
```

PR checklist item: maintainer applies and merges the `release.yml` change; the "GitHub Release body"
acceptance criterion (US3) stays open until then.
