#!/bin/bash
set -euo pipefail

project_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="$project_dir/macos/build"
mkdir -p "$output_dir"
build_dir="$(mktemp -d "$output_dir/stillplay.XXXXXXXX")"
trap 'rm -rf "$build_dir"' EXIT

app="$build_dir/Stillplay.app"
contents="$app/Contents"
site="$contents/Resources/site"
mkdir -p "$contents/MacOS" "$site/cores"

cp "$project_dir/macos/Info.plist" "$contents/Info.plist"
cp "$project_dir/macos/ApplicationIcon.icns" "$contents/Resources/"
cp "$project_dir/index.html" "$project_dir/LICENSE" "$site/"
cp -R "$project_dir/public/." "$site/"
cp -R "$project_dir/src" "$site/src"
cp "$project_dir"/cores/*.wasm "$site/cores/"

/usr/bin/xcrun swiftc -O -target "$(uname -m)-apple-macos13.0" \
  -module-cache-path "$output_dir/module-cache" \
  "$project_dir/macos/main.swift" -o "$contents/MacOS/Stillplay"
/usr/bin/codesign --sign - "$app"
/usr/bin/codesign --verify --strict "$app"

trap - EXIT
printf '%s\n' "$app"
