#!/usr/bin/env python
"""MinerU 模型权重下载脚本（Task 8，2026-09-06）。

将 MinerU 模型权重下载到仓库 `model/mineru/`（不经镜像固化），供 WSL 容器经卷挂载读取。
依赖 mineru 官方 CLI `mineru-models-download`（与镜像内一致），模型源可选 modelscope（国内网络）。

用法：
  python scripts/image-model/download-models.py               # 下载全部模型到 model/mineru/
  python scripts/image-model/download-models.py --source hf   # 用 HuggingFace 源
  python scripts/image-model/download-models.py --target <dir> # 自定义输出目录

退出码：0 成功/已下载；1 运行失败；2 参数错误（argparse）。
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]                 # scripts/image-model/ → 仓库根
DEFAULT_TARGET = ROOT / "model" / "mineru"                  # 默认输出目录（model/mineru 挂载源）
MODEL_SOURCE_DEFAULT = "modelscope"


def _mineru_models_download() -> str | None:
    """mineru-models-download CLI 路径；未安装返回 None。"""
    return shutil.which("mineru-models-download")


def _run_download(target: Path, source: str, model: str | None) -> int:
    cli = _mineru_models_download()
    if cli is None:
        print("mineru-models-download 未安装：请先 pip install 'mineru[core]'（见 infra 指南）")
        return 1
    target.mkdir(parents=True, exist_ok=True)
    cmd = [cli, "-s", source, "-m", model] if model else [cli, "-s", source, "-m", "all"]
    print(f"下载 MinerU 模型（source={source}, target={target}）…")
    try:
        result = subprocess.run(cmd, cwd=str(target), timeout=3600, check=False)
        if result.returncode != 0:
            print(f"mineru-models-download 退出码 {result.returncode}")
            return 1
    except (OSError, subprocess.SubprocessError, subprocess.TimeoutExpired) as exc:
        print(f"下载失败：{type(exc).__name__}")
        return 1
    print(f"模型已就绪：{target}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="download-models",
        description="下载 MinerU 模型权重到仓库 model/mineru/（供容器卷挂载，镜像不固化模型）。",
    )
    parser.add_argument("--source", default=MODEL_SOURCE_DEFAULT,
                        help="模型源（modelscope 默认 / hf）；对应 -s 参数")
    parser.add_argument("--model", default=None,
                        help="指定模型名（-m），默认 all（全部）")
    parser.add_argument("--target", type=Path, default=DEFAULT_TARGET,
                        help=f"输出目录（默认 {DEFAULT_TARGET}，即 model/mineru）")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return _run_download(args.target, args.source, args.model)


if __name__ == "__main__":
    sys.exit(main())
