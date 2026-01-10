# Publishing Metaverse Kit to npm

## Prerequisites

- ✅ Git tag created: `v0.1.0`
- ✅ npm account: `bthornemail`
- ✅ Packages configured for publication
- ⚠️ **Required:** 2FA authenticator app for OTP codes

## Publishing Instructions

Since your npm account has 2FA enabled, you need to provide an OTP (one-time password) for each publish command.

### Option 1: Publish with OTP (Recommended)

Publish packages in dependency order, providing your OTP code each time:

```bash
# Get your OTP code from your authenticator app
# Then publish each package:

# Phase 1: Foundation packages (no dependencies)
cd packages/protocol
npm publish --otp=YOUR_6_DIGIT_CODE
cd ../..

cd packages/addr
npm publish --otp=YOUR_6_DIGIT_CODE
cd ../..

# Phase 2: Dependent packages
cd packages/nf
npm publish --otp=YOUR_6_DIGIT_CODE
cd ../..

cd packages/tilestore
npm publish --otp=YOUR_6_DIGIT_CODE
cd ../..

cd packages/shadow-canvas
npm publish --otp=YOUR_6_DIGIT_CODE
cd ../..
```

### Option 2: Interactive Publishing

Run the publish script and provide OTP when prompted:

```bash
# Start in packages/protocol
cd packages/protocol
npm publish
# Enter OTP when prompted

# Continue with each package...
```

### Option 3: Disable 2FA Temporarily (Not Recommended)

If you want to disable 2FA temporarily:
1. Go to https://www.npmjs.com/settings/bthornemail/security
2. Disable 2FA
3. Run: `bash scripts/publish-all.sh`
4. Re-enable 2FA

## Verification

After publishing, verify packages are live:

```bash
# Check each package
npm view @metaverse-kit/protocol
npm view @metaverse-kit/addr
npm view @metaverse-kit/nf
npm view @metaverse-kit/tilestore
npm view @metaverse-kit/shadow-canvas
```

Or visit:
- https://www.npmjs.com/package/@metaverse-kit/protocol
- https://www.npmjs.com/package/@metaverse-kit/addr
- https://www.npmjs.com/package/@metaverse-kit/nf
- https://www.npmjs.com/package/@metaverse-kit/tilestore
- https://www.npmjs.com/package/@metaverse-kit/shadow-canvas

## Post-Publishing

### Tag the release
```bash
git tag -a v0.1.0-published -m "v0.1.0 published to npm"
```

### Push to GitHub (if you have a remote)
```bash
# Add your GitHub repo as remote
git remote add origin https://github.com/your-username/metaverse-kit.git

# Push code and tags
git push -u origin main
git push origin v0.1.0
git push origin v0.1.0-published
```

### Update README badges

Add npm badges to README.md:

```markdown
[![npm version](https://badge.fury.io/js/%40metaverse-kit%2Fprotocol.svg)](https://www.npmjs.com/package/@metaverse-kit/protocol)
```

## Installation Guide for Users

After publishing, users can install with:

```bash
# Install all packages
npm install @metaverse-kit/protocol @metaverse-kit/addr @metaverse-kit/nf @metaverse-kit/tilestore @metaverse-kit/shadow-canvas

# Or install just what they need
npm install @metaverse-kit/protocol @metaverse-kit/shadow-canvas
```

## Troubleshooting

### OTP expired
OTP codes expire after 30 seconds. Get a fresh code from your authenticator app.

### Package already exists
If you get an error that the package version already exists:
1. Increment version in package.json
2. Commit: `git commit -am "Bump to v0.1.1"`
3. Tag: `git tag v0.1.1`
4. Try publishing again

### Access denied
Make sure you're logged in: `npm whoami`

If not: `npm login`

### Network error
Check your internet connection and try again.

## Current Status

- ✅ Git tag `v0.1.0` created
- ✅ Packages configured for npm
- ✅ Logged into npm as `bthornemail`
- ⏳ **Awaiting OTP codes for publishing**

## Quick Publish Commands

```bash
# Copy-paste these one at a time, replacing YOUR_OTP with your current code:

cd /data/data/com.termux/files/home/metaverse-kit/packages/protocol && npm publish --otp=YOUR_OTP && cd ../..
cd /data/data/com.termux/files/home/metaverse-kit/packages/addr && npm publish --otp=YOUR_OTP && cd ../..
cd /data/data/com.termux/files/home/metaverse-kit/packages/nf && npm publish --otp=YOUR_OTP && cd ../..
cd /data/data/com.termux/files/home/metaverse-kit/packages/tilestore && npm publish --otp=YOUR_OTP && cd ../..
cd /data/data/com.termux/files/home/metaverse-kit/packages/shadow-canvas && npm publish --otp=YOUR_OTP && cd ../..
```

Replace `YOUR_OTP` with the 6-digit code from your authenticator app (Google Authenticator, Authy, etc.).
