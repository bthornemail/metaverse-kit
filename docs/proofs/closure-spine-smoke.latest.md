# Closure Spine Smoke Proof

Date: 2026-03-07
Command:

```bash
cd /home/main/devops
./scripts/closure-spine-smoke.sh | tee /tmp/closure-spine-smoke-latest.log
```

Key excerpt:

```txt
WARN: no passing snapshot found for inputs_digest=sha256:b7a14876ffaf4e1edd4fc369af4ff61d504ac1102a6a6e0b8dba08b654023dd7
[8a/9] metaverse-kit: No-authority gate
[8a6b/9] metaverse-kit: wave17 conflict bundle golden
[8a6c/9] metaverse-kit: wave17 conflict bundle must-reject
[8a6d/9] metaverse-kit: wave17 merge review golden
[8a6e/9] metaverse-kit: wave17 merge review must-reject
[8a6f/9] metaverse-kit: wave17 merge review render golden
[8a6g/9] metaverse-kit: wave17 merge review render must-reject
[8a6h/9] metaverse-kit: wave27 pointer sync golden
[8a6i/9] metaverse-kit: wave27 pointer sync must-reject
[8a6j/9] metaverse-kit: wave28 golden
[8a6k/9] metaverse-kit: wave28 must-reject
[8a6l/9] metaverse-kit: wave28 client guard
[8a6m/9] metaverse-kit: wave29 golden
[8a6n/9] metaverse-kit: wave29 must-reject
[8a6o/9] metaverse-kit: wave30 golden
[8a6p/9] metaverse-kit: wave30 must-reject
[8a6q/9] metaverse-kit: wave30 frames golden
[8a6r/9] metaverse-kit: wave30 frames must-reject
[8a6s/9] metaverse-kit: wave30 emitter golden
[8a6t/9] metaverse-kit: wave30 emitter must-reject
[8a6u/9] metaverse-kit: wave30 uart golden
[8a6v/9] metaverse-kit: wave30 uart must-reject
[8a6w/9] metaverse-kit: runtime handoff wave30 contract
[8a6x/9] metaverse-kit: runtime handoff wave31 contract
[8a6y/9] metaverse-build: governed runtime world-ir closure
[8a6y1/9] metaverse-build: transport-noise federated equivalence closure
[8a6y2/9] metaverse-build: operational rollback/restore drill closure
[8a6y3/9] metaverse-kit: ops attestation contract
[8a6z/9] metaverse-kit: runtime materialize wave31 contract
ok closure spine smoke
```
