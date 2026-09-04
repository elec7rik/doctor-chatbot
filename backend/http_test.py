"""Tests the running FastAPI server: /health, /chat, and session continuity
(a follow-up in the same session should EXPAND, proving history works)."""
import json
import time
import urllib.error
import urllib.request

BASE = "http://localhost:8123"


def get(path):
    return json.load(urllib.request.urlopen(BASE + path, timeout=10))


def chat(message, session_id=None):
    payload = {"message": message}
    if session_id:
        payload["session_id"] = session_id
    req = urllib.request.Request(
        BASE + "/chat", json.dumps(payload).encode(), {"content-type": "application/json"}
    )
    return json.load(urllib.request.urlopen(req, timeout=90))


# wait for boot
for _ in range(40):
    try:
        print("HEALTH:", get("/health"))
        break
    except Exception:
        time.sleep(0.5)
else:
    raise SystemExit("server did not come up")

r1 = chat("does NMN reverse ageing?")
print(f"\n[reply 1 | session {r1['session_id']} | should be SNAPPY]\n{r1['reply']}")

r2 = chat("yes, the full breakdown please", r1["session_id"])
print(f"\n[reply 2 | SAME session | should EXPAND using history]\n{r2['reply']}")
