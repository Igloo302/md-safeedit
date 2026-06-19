#!/bin/bash

# Exit on any error
set -e

echo "📦 Starting publication of @md-safeedit packages to NPM..."

# Order of publication based on internal dependency structure:
# 1. core (no internal dependencies)
# 2. protocol (depends on core)
# 3. markdown (depends on core)
# 4. cli (depends on core, markdown, protocol)
# 5. mcp (depends on core, markdown, protocol, cli)

for pkg in core protocol markdown cli mcp; do
  echo ""
  echo "------------------------------------------------"
  echo "🚀 Publishing @md-safeedit/$pkg..."
  echo "------------------------------------------------"
  cd packages/$pkg
  npm publish --tag dev --access public
  cd ../..
done

echo ""
echo "✅ All packages successfully published to NPM!"
