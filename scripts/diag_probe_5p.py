# 一次性诊断辅助（本轮 b05 全本重跑排查用，可删）
import json
import sys
import time
import urllib.error
import urllib.request

req = urllib.request.Request(
    "http://127.0.0.1:8902/api/v1/parse-jobs",
    data=json.dumps({"book_id": "mathanalysis-b05", "pages": [1, 2, 3, 4, 5]}).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
try:
    resp = urllib.request.urlopen(req, timeout=60)
    body = json.loads(resp.read().decode("utf-8"))
    print("submitted:", resp.status, json.dumps(body, ensure_ascii=False))
except urllib.error.HTTPError as e:
    print("HTTPError:", e.code, e.read().decode("utf-8", "replace")[:500])
    sys.exit(1)

jid = body["id"]
t0 = time.time()
while time.time() - t0 < 900:
    time.sleep(20)
    d = json.loads(urllib.request.urlopen(
        f"http://127.0.0.1:8902/api/v1/parse-jobs/{jid}", timeout=15).read().decode("utf-8"))
    print(int(time.time() - t0), "s", d["status"], json.dumps(d["progress"], ensure_ascii=False), flush=True)
    if d["status"] in ("completed", "failed", "done", "error"):
        print("final error:", d.get("error", ""))
        break
