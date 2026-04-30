#!/bin/bash
# Sync context files to a single folder for AI consumption

mkdir -p .context
cp PROJECT.md ARCHITECTURE.md IDEAS.md DEBUG.md USAGE.md CHANGELOG.md package.json .context/

echo "✅ Context files synced to .context/"
ls -l .context
