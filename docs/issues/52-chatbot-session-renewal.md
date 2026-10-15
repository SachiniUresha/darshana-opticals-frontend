# Frontend #52: chatbot session exhaustion and renewal

The backend owns the shared fixed 30-minute Customer window and its 20 message
slots (ten question/reply exchanges). The widget distinguishes session exhaustion
(`CHATBOT_SESSION_EXHAUSTED`) from ordinary per-minute throttling
(`RATE_LIMIT_EXCEEDED`) and usage-storage unavailability
(`CHATBOT_USAGE_UNAVAILABLE`). Raw server/provider diagnostics are never rendered.

Integer `Retry-After` seconds are read through the shared API client. A valid
value pauses send/retry actions until that response's remaining interval expires.
The widget announces the retry time and later makes submission available without
a refresh. It never polls or sends automatically, and a renewed send may still be
rejected if another tab/device consumes the Customer allowance. Invalid/missing
headers leave safe guidance and an explicit manual retry available, without
assuming a new 30-minute delay. Only bounded representable timer values are used.

The current tab retains at most 20 complete recent transcript messages. It rolls
older entries out rather than using transcript length to block sends permanently.
Successful response text is never truncated, request context stays bounded at six
messages and oversized context still requires the existing explicit standalone
choice. Changing local transcript contents does not alter backend usage.
Logout/tab close and Customer ownership guards retain their existing privacy
lifecycle. No session identifier, reset API, automatic retry or new history
storage is introduced.

Deployment dependency: the backend must expose `Retry-After` through CORS for
cross-origin browser reads. Without it, the safe missing-header/manual-retry path
still works. The supporting backend PR is linked from the frontend PR description.

Validation includes shared-client header parsing, fake-time server renewal,
repeated exhaustion from shared usage, transcript-bound renewal, unmount cleanup
and connected-widget/input/history/logout regression tests. Backend #77 and ADR
PR documents#37 remain authoritative for server enforcement.
