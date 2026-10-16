#!/usr/bin/env bash
set -euo pipefail

readonly version='2.18.0'
readonly checksum='defe4dbe1a5afc456f030615508e2d77c2363c40ecc4ef74d18cdbff7e1ac6fe'
readonly archive="router-v${version}-x86_64-unknown-linux-gnu.tar.gz"

if [[ "$(uname -s)" != 'Linux' || "$(uname -m)" != 'x86_64' ]]; then
  echo 'Apollo Router installation supports Ubuntu/WSL on x86_64 only.' >&2
  exit 1
fi

router_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
download_dir="$(mktemp -d -t holita-router.XXXXXXXX)"
readonly router_dir download_dir
trap 'rm -rf -- "$download_dir"' EXIT

curl --fail --location --silent --show-error --retry 3 --proto '=https' --proto-redir '=https' \
  "https://github.com/apollographql/router/releases/download/v${version}/${archive}" \
  --output "${download_dir}/${archive}"
printf '%s  %s\n' "$checksum" "${download_dir}/${archive}" | sha256sum --check --status
tar --extract --gzip --file "${download_dir}/${archive}" --directory "$download_dir"
mkdir -p -- "${router_dir}/dist"
install -m 755 "${download_dir}/dist/router" "${router_dir}/dist/router"
install -m 644 "${download_dir}/dist/LICENSE" "${download_dir}/dist/licenses.html" \
  "${download_dir}/dist/README.md" "${router_dir}/dist/"
"${router_dir}/dist/router" --version
