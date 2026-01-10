#!/bin/bash
# Publish all Metaverse Kit packages to npm in dependency order

set -e  # Exit on error

echo "🚀 Publishing Metaverse Kit packages to npm"
echo "============================================"
echo ""

# Ensure everything is built
echo "📦 Building all packages..."
npm run build
echo ""

# Phase 1: Publish foundation packages (no internal dependencies)
echo "Phase 1: Publishing foundation packages..."
echo ""

cd packages/protocol
echo "  📤 Publishing @metaverse-kit/protocol..."
npm publish
cd ../..

cd packages/addr
echo "  📤 Publishing @metaverse-kit/addr..."
npm publish
cd ../..

echo ""
echo "✅ Phase 1 complete"
echo ""

# Give npm registry a moment to update
echo "⏳ Waiting for npm registry to update..."
sleep 3
echo ""

# Phase 2: Publish packages that depend on phase 1
echo "Phase 2: Publishing dependent packages..."
echo ""

cd packages/nf
echo "  📤 Publishing @metaverse-kit/nf..."
npm publish
cd ../..

cd packages/tilestore
echo "  📤 Publishing @metaverse-kit/tilestore..."
npm publish
cd ../..

cd packages/shadow-canvas
echo "  📤 Publishing @metaverse-kit/shadow-canvas..."
npm publish
cd ../..

echo ""
echo "✅ Phase 2 complete"
echo ""

# Summary
echo "============================================"
echo "🎉 All packages published successfully!"
echo ""
echo "Published packages:"
echo "  ✅ @metaverse-kit/protocol@0.1.0"
echo "  ✅ @metaverse-kit/addr@0.1.0"
echo "  ✅ @metaverse-kit/nf@0.1.0"
echo "  ✅ @metaverse-kit/tilestore@0.1.0"
echo "  ✅ @metaverse-kit/shadow-canvas@0.1.0"
echo ""
echo "View on npm:"
echo "  https://www.npmjs.com/package/@metaverse-kit/protocol"
echo "  https://www.npmjs.com/package/@metaverse-kit/addr"
echo "  https://www.npmjs.com/package/@metaverse-kit/nf"
echo "  https://www.npmjs.com/package/@metaverse-kit/tilestore"
echo "  https://www.npmjs.com/package/@metaverse-kit/shadow-canvas"
echo ""
echo "Users can now install with:"
echo "  npm install @metaverse-kit/protocol"
echo ""
