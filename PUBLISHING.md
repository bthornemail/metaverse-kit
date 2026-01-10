# Publishing Metaverse Kit to npm

## Current Published Versions

Published to `@metaverse-kit`:
- `@metaverse-kit/protocol@0.0.0-alpha.1`
- `@metaverse-kit/addr@0.0.0-alpha.1`
- `@metaverse-kit/nf@0.0.0-alpha.1`
- `@metaverse-kit/tilestore@0.0.0-alpha.1`
- `@metaverse-kit/shadow-canvas@0.0.0-alpha.1`

Not published yet:
- `@metaverse-kit/basis32`
- `@metaverse-kit/discovery`

## Prerequisites

- npm account with access to `@metaverse-kit`
- ⚠️ **Required:** 2FA authenticator app for OTP codes

## Publishing Instructions

Since npm 2FA is enabled, provide an OTP (one-time password) for each publish command.

### Publish with OTP

```bash
cd packages/protocol && npm publish --otp=YOUR_6_DIGIT_CODE && cd ../..
cd packages/addr && npm publish --otp=YOUR_6_DIGIT_CODE && cd ../..
cd packages/nf && npm publish --otp=YOUR_6_DIGIT_CODE && cd ../..
cd packages/tilestore && npm publish --otp=YOUR_6_DIGIT_CODE && cd ../..
cd packages/shadow-canvas && npm publish --otp=YOUR_6_DIGIT_CODE && cd ../..
cd packages/basis32 && npm publish --otp=YOUR_6_DIGIT_CODE && cd ../..
cd packages/discovery && npm publish --otp=YOUR_6_DIGIT_CODE && cd ../..
```

### Verification

```bash
npm view @metaverse-kit/protocol
npm view @metaverse-kit/addr
npm view @metaverse-kit/nf
npm view @metaverse-kit/tilestore
npm view @metaverse-kit/shadow-canvas
npm view @metaverse-kit/basis32
npm view @metaverse-kit/discovery
```

Or visit:
- https://www.npmjs.com/package/@metaverse-kit/protocol
- https://www.npmjs.com/package/@metaverse-kit/addr
- https://www.npmjs.com/package/@metaverse-kit/nf
- https://www.npmjs.com/package/@metaverse-kit/tilestore
- https://www.npmjs.com/package/@metaverse-kit/shadow-canvas
- https://www.npmjs.com/package/@metaverse-kit/basis32
- https://www.npmjs.com/package/@metaverse-kit/discovery

## Post-Publishing

```bash
git tag -a v0.0.0-alpha.1-published -m "v0.0.0-alpha.1 published to npm"
git push -u origin main
git push origin v0.0.0-alpha.1-published
```

## Installation Guide for Users

```bash
npm install @metaverse-kit/protocol @metaverse-kit/addr @metaverse-kit/nf @metaverse-kit/tilestore @metaverse-kit/shadow-canvas @metaverse-kit/basis32 @metaverse-kit/discovery
```

## Troubleshooting

### OTP expired
OTP codes expire after 30 seconds. Get a fresh code from your authenticator app.

### Package already exists
If you get an error that the package version already exists:
1. Increment version in package.json
2. Commit: `git commit -am "Bump version"`
3. Tag: `git tag vX.Y.Z`
4. Try publishing again

### Access denied
Make sure you're logged in: `npm whoami`

### Network error
Check your internet connection and try again.

## Licensing

Before publishing or redistributing, review the repository licenses:
- Architecture Preservation License (APL): `docs/licenses/architecture-preservation-license.md`
- Hitecture Preservation License (HPL): `docs/licenses/hitecture-preservation-license.md`
