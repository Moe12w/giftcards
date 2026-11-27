# Sandbox seed data

Run `seed.sql` after migrations `0174`–`0180` on a disposable/staging database:

```bash
psql "$TEST_DATABASE_URL" -f supabase/sandbox/seed.sql
```

It is idempotent and safe to re-run.

## Fixed sandbox credential

```
X-Platform-Code: mock
X-Environment:   sandbox
API key:         tz_sandbox_mock_key_0123456789abcdef
Signing secret:  tz_sandbox_mock_secret_0123456789abcdef
External vendor: SBX-1001
Branch:          SBX-1001-01
Currency:        QAR
```

These are public test values. Never deploy them to production.

## Scenarios

| Card code | State |
|---|---|
| `SBX-GOOD` | 500 QAR available, mapped vendor |
| `SBX-EXPIRED` | Expired |
| `SBX-EMPTY` | Zero balance |
| `SBX-OTHER` | Belongs to a different vendor |
| `SBX-HELD` | 15 QAR held by an active reservation |

## Signed request example

Sign with `HMAC-SHA256(signing_secret, timestamp + "." + raw_body)` and send
`X-Timestamp` plus `X-Signature` (hex). Money-moving calls also require
`X-Idempotency-Key`. See `tests/integrations/gateway.e2e.test.ts`.
