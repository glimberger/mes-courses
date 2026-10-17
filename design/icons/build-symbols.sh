#!/usr/bin/env bash
# Generates the Material Symbols Rounded icon fonts used by the mobile app.
#
# Downloads the variable font and its codepoint table from google/material-design-icons at a
# pinned commit (SHA-256 checked), makes two static instances with fonttools, subsets them to
# the names listed in symbols.txt and writes:
#   - apps/mobile/assets/fonts/MaterialSymbolsRounded_500.ttf (every listed name)
#   - apps/mobile/assets/fonts/MaterialSymbolsRounded_700.ttf (check only)
#   - apps/mobile/src/adapters/ui/icons/symbols-glyphs.json   (name -> code point, sorted)
#
# Needs network access and nix (fonttools is fetched through `nix shell`).
set -euo pipefail

readonly MSR_COMMIT="49d4db35df873165d6bd6ba09b063c7dafbac2f4"
readonly MSR_BASE_URL="https://raw.githubusercontent.com/google/material-design-icons/${MSR_COMMIT}/variablefont"
readonly MSR_TTF_FILE="MaterialSymbolsRounded%5BFILL,GRAD,opsz,wght%5D.ttf"
readonly MSR_TTF_SHA256="32e4011709e055596eb8d2dd0f7cb547b47c1d40ac9ecb8fad54f7f7eac202e7"
readonly MSR_CODEPOINTS_FILE="MaterialSymbolsRounded%5BFILL,GRAD,opsz,wght%5D.codepoints"
readonly MSR_CODEPOINTS_SHA256="0c9dae3ed678a81549c3be046bc8045335e5f57f2cbe2287360fbf0c2cc1355f"
readonly WEIGHT_CHECK_ONLY="check"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "${script_dir}/../.." && pwd)"
fonts_dir="${repo_root}/apps/mobile/assets/fonts"
icons_dir="${repo_root}/apps/mobile/src/adapters/ui/icons"
symbols_file="${icons_dir}/symbols.txt"
glyphs_file="${icons_dir}/symbols-glyphs.json"

work_dir="$(mktemp -d)"
trap 'rm -rf "${work_dir}"' EXIT

sha256_of() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d ' ' -f 1
  else
    shasum -a 256 "$1" | cut -d ' ' -f 1
  fi
}

verify_sha256() {
  local file="$1"
  local expected="$2"
  local actual
  actual="$(sha256_of "${file}")"
  if [ "${actual}" != "${expected}" ]; then
    echo "SHA-256 mismatch for ${file}: expected ${expected}, got ${actual}" >&2
    exit 1
  fi
}

# Run a fonttools command from the pinned nix package, without adding it to the project.
fonttools_run() {
  nix shell nixpkgs#python3Packages.fonttools --command "$@"
}

curl -fsSL -o "${work_dir}/msr.ttf" "${MSR_BASE_URL}/${MSR_TTF_FILE}"
verify_sha256 "${work_dir}/msr.ttf" "${MSR_TTF_SHA256}"

curl -fsSL -o "${work_dir}/msr.codepoints" "${MSR_BASE_URL}/${MSR_CODEPOINTS_FILE}"
verify_sha256 "${work_dir}/msr.codepoints" "${MSR_CODEPOINTS_SHA256}"

# Resolve every listed name to its code point; a missing name stops the build.
grep -v '^$' "${symbols_file}" | LC_ALL=C sort -u > "${work_dir}/names.txt"
awk 'NR == FNR { code[$1] = $2; next } { if (!($1 in code)) missing = missing " " $1; else print $1, code[$1] }
  END { if (missing != "") { print "Unknown symbol names:" missing > "/dev/stderr"; exit 1 } }' \
  "${work_dir}/msr.codepoints" "${work_dir}/names.txt" > "${work_dir}/glyphs.txt"

# Glyph map: JSON object, keys sorted, code points as decimal numbers.
{
  echo "{"
  separator=""
  while read -r name hex_code; do
    printf '%s  "%s": %d' "${separator}" "${name}" "$((16#${hex_code}))"
    separator=$',\n'
  done < "${work_dir}/glyphs.txt"
  echo ""
  echo "}"
} > "${glyphs_file}"

# Static instances at weight 500 (every name) and 700 (check only).
fonttools_run fonttools varLib.instancer "${work_dir}/msr.ttf" FILL=0 wght=500 GRAD=0 opsz=24 \
  --no-recalc-timestamp -o "${work_dir}/instance-500.ttf"
fonttools_run fonttools varLib.instancer "${work_dir}/msr.ttf" FILL=0 wght=700 GRAD=0 opsz=24 \
  --no-recalc-timestamp -o "${work_dir}/instance-700.ttf"

unicodes_500="$(awk '{ printf "%s%s", (NR > 1 ? "," : ""), $2 }' "${work_dir}/glyphs.txt")"
unicodes_700="$(awk -v check="${WEIGHT_CHECK_ONLY}" '$1 == check { print $2 }' "${work_dir}/glyphs.txt")"

fonttools_run pyftsubset "${work_dir}/instance-500.ttf" --unicodes="${unicodes_500}" \
  --no-recalc-timestamp --output-file="${fonts_dir}/MaterialSymbolsRounded_500.ttf"
fonttools_run pyftsubset "${work_dir}/instance-700.ttf" --unicodes="${unicodes_700}" \
  --no-recalc-timestamp --output-file="${fonts_dir}/MaterialSymbolsRounded_700.ttf"

echo "Wrote $(wc -l < "${work_dir}/glyphs.txt" | tr -d ' ') glyphs to ${glyphs_file}"
