# mv-avatar-role

Build and validate `wave18.avatar_role.v0` artifacts.

## Emit

```bash
npm run -s mv-avatar-role -- emit \
  --seed dev-docs/wave18/role.solon.seed.json \
  --out dev-docs/wave18/role.solon.v0.json
```

## Validate

```bash
npm run -s mv-avatar-role -- validate \
  --role dev-docs/wave18/role.solon.v0.json
```
