# b05 全本 job 进度监视（只读轮询，可删）
import json
import sys
import time
import urllib.request

BASE = "http://127.0.0.1:8902"
JOB = "7af72c68180e"
while True:
    try:
        d = json.loads(urllib.request.urlopen(f"{BASE}/api/v1/parse-jobs/{JOB}", timeout=15).read())
        h = json.loads(urllib.request.urlopen(f"{BASE.replace('8902', '5002')}/health", timeout=10).read())
    except Exception as exc:  # noqa: BLE001
        print(int(time.time()), "poll-error:", exc, flush=True)
        time.sleep(120)
        continue
    print(int(time.time()), d["status"], d["progress"], "err:", d.get("error", ""),
          "mineru q/p/c/f:", h["queued_tasks"], h["processing_tasks"], h["completed_tasks"], h["failed_tasks"], flush=True)
    if d["status"] not in ("queued", "running"):
        break
    time.sleep(300)
