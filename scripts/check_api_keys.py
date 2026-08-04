"""验证各供应商 API key 与推荐模型是否真实可用（不打印密钥）。

用法（根仓库目录）：
    python scripts/check_api_keys.py

跳过项：
- GLM_OCR_MODEL（glm-ocr 走文档解析专用接口，Axiom-Flow 对接轮适配）
- DEEPSEEK（DEEPSEEK_API_KEY 未配置前自动跳过）
"""

import sys
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / ".env"

QWEN_BASE = "https://dashscope.aliyuncs.com/compatible-mode/v1"
GLM_BASE = "https://open.bigmodel.cn/api/paas/v4"


def load_env() -> dict[str, str]:
    """读取根 .env（简单解析，不依赖外部包）。"""
    values: dict[str, str] = {}
    if not ENV_FILE.exists():
        return values
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        values[key.strip()] = value.strip()
    return values


def check_chat(env: dict[str, str], name: str, model: str, key_var: str, base_url: str) -> httpx.Response | None:
    key = env.get(key_var, "")
    if not key:
        print(f"[SKIP] {name}: {key_var} 未配置")
        return None
    try:
        resp = httpx.post(
            f"{base_url}/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": model, "messages": [{"role": "user", "content": "回复:ok"}], "max_tokens": 16},
            timeout=60,
        )
    except httpx.HTTPError as exc:
        print(f"[FAIL] {name}: 请求异常 {exc}")
        return None
    body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    ok = resp.status_code == 200 and "choices" in body
    print(f"[{'OK' if ok else 'FAIL'}] {name}: HTTP {resp.status_code}, model={model}")
    if not ok:
        print("   body:", resp.text[:300])
    return resp


def check_embedding(env: dict[str, str], model: str) -> httpx.Response | None:
    key = env.get("QWEN_API_KEY", "")
    if not key:
        print("[SKIP] qwen embedding: QWEN_API_KEY 未配置")
        return None
    try:
        resp = httpx.post(
            f"{QWEN_BASE}/embeddings",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": model, "input": "测试文本"},
            timeout=60,
        )
    except httpx.HTTPError as exc:
        print(f"[FAIL] qwen embedding: 请求异常 {exc}")
        return None
    body = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
    ok = resp.status_code == 200 and "data" in body
    print(f"[{'OK' if ok else 'FAIL'}] qwen embedding: HTTP {resp.status_code}, model={model}")
    if not ok:
        print("   body:", resp.text[:300])
    return resp


def main() -> int:
    env = load_env()
    results = [
        check_chat(env, "qwen chat", env.get("QED_MODEL", ""), "QWEN_API_KEY", QWEN_BASE),
        check_embedding(env, env.get("QED_EMBEDDING_MODEL", "")),
        check_chat(env, "glm chat", env.get("GLM_MODEL", ""), "GLM_API_KEY", GLM_BASE),
    ]
    print("[SKIP] glm_ocr: glm-ocr 走文档解析专用接口，Axiom-Flow 对接轮适配")
    failed = any(r is not None and r.status_code != 200 for r in results)
    print("结果:", "全部通过" if not failed else "存在失败，请检查")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
