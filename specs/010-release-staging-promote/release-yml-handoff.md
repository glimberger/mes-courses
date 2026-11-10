# Hand-off: `release.yml` and `deliver-staging.yml` (issue #204, ADR-0015)

The workflow directory is maintainer-only (`docs/agent-guardrails.md`), so these changes are not part
of the branch. The maintainer applies them in the pull request of #204: `pack-server.sh` now takes
`<commit> [output folder]`, so `deliver-staging.yml` must change with it or staging stops packing.
Both files were checked with `actionlint` (no finding) on scratch copies outside the repository.

## `release.yml`: `server-artifact` downloads and verifies the staging archive

```diff
@@ -56,10 +56,13 @@
         if: always()
         run: sh .github/scripts/delivery-summary.sh gate "${{ job.status }}" "$GITHUB_SERVER_URL/$GITHUB_REPOSITORY/actions/runs/$GITHUB_RUN_ID"
 
+  # Takes the server archive that staging delivered for this commit instead of building it
+  # (ADR-0015): the same bytes run on both channels. The job stops the release, before anything
+  # is published, when the archive is missing or does not match; it never rebuilds the server.
   server-artifact:
     needs: gate
     runs-on: ubuntu-latest
-    timeout-minutes: 20
+    timeout-minutes: 10
     steps:
       - uses: actions/checkout@v7
         with:
@@ -70,12 +73,28 @@
           primary-key: nix-${{ runner.os }}-${{ hashFiles('flake.nix', 'flake.lock') }}
           restore-prefixes-first-match: nix-${{ runner.os }}-
       - run: nix develop --command pnpm install --frozen-lockfile
-      - run: nix develop --command pnpm build
-      - name: Pack the server
+      - name: Take the staging server archive
+        id: staging
         env:
-          VERSION: ${{ needs.gate.outputs.version }}
-          SEQUENCE: ${{ needs.gate.outputs.sequence }}
-        run: nix develop --command sh .github/scripts/pack-server.sh "$VERSION" "$SHA" "$SEQUENCE" "$RUNNER_TEMP/out"
+          GITHUB_TOKEN: ${{ github.token }}
+          GH_TOKEN: ${{ github.token }}
+        run: |
+          set -eu
+          nix develop --command pnpm --filter @mes-courses/delivery --silent run ci fetch-staging-server \
+            --commit "$SHA" --out "$RUNNER_TEMP/out" > "$RUNNER_TEMP/staging.out"
+          cat "$RUNNER_TEMP/staging.out" >> "$GITHUB_OUTPUT"
+      - name: Check the archive is the one staging delivered
+        env:
+          EXPECTED_SHA256: ${{ steps.staging.outputs.sha256 }}
+          BUILT_COMMIT: ${{ steps.staging.outputs.built-commit }}
+          BUILT_VERSION: ${{ steps.staging.outputs.built-version }}
+        run: |
+          set -eu
+          sh .github/scripts/check-staging-server.sh "$RUNNER_TEMP/out/server-$SHA.tar.gz" "$EXPECTED_SHA256"
+          {
+            echo "### Server archive taken from staging"
+            echo "- built at \`$BUILT_COMMIT\` as \`$BUILT_VERSION\`, sha256 \`$EXPECTED_SHA256\`"
+          } >> "$GITHUB_STEP_SUMMARY"
       - uses: actions/upload-artifact@v7
         with:
           name: server-production
```

`publish` is unchanged: it still uploads `server-production/server-$SHA.tar.gz` and runs
`write-manifest --server` on it, which hashes the file (the checksum of the staging archive) and writes
the production entry.

## `deliver-staging.yml`: the archive no longer takes a version

```diff
@@ -97,12 +97,9 @@
       - run: nix develop --command pnpm install --frozen-lockfile
       - run: nix develop --command pnpm build
       - name: Pack the server
-        env:
-          SEQUENCE: ${{ needs.plan.outputs.sequence }}
-        # Named after the app version, like production: the release X.Y.Z is first X.Y.Z-staging.<n>.
-        run: |
-          base=$(nix develop --command pnpm --filter @mes-courses/delivery --silent run ci app-version)
-          nix develop --command sh .github/scripts/pack-server.sh "$base-staging.$SEQUENCE" "$SHA" "$SEQUENCE" "$RUNNER_TEMP/out"
+        # The archive holds nothing environment-specific (ADR-0015): production promotes these bytes.
+        # The version name and build-info.json come from the manifest, written by the agent.
+        run: nix develop --command sh .github/scripts/pack-server.sh "$SHA" "$RUNNER_TEMP/out"
       - uses: actions/upload-artifact@v7
         with:
           name: server-staging
```

## Order

1. Merge both workflow changes with the pull request.
2. Update the agent on the Pi to 1.1.0 (it writes `build-info.json`; manifests now need it):
   [updating the agent](../../docs/procedures/updating-the-agent.md).
