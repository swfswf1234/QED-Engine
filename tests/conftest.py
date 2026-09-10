"""根测试基座：对跨用例共享的「真实系统副作用」打桩，保证测试独立、快速、无外部依赖。

设计关联（DesignRef）：docs/architecture/api-contracts.md
实现状态：Current

背景（2026-09-06 Task 2）：probe_gpu 缺省走 probe_pdh()，其 _run_pdh 会真实调用 PowerShell
Get-Counter（本机每路 ~1.2~1.6s，多个 probe_gpu 用例 ×2 路 → 拖慢整个套件）。本 autouse
fixture 将 monitor.subprocess.run 打桩为「无 PowerShell」（抛 FileNotFoundError），使 _run_pdh
捕获返回空串、probe_pdh 走「空结果」降级（回落 nvidia-smi 口径）。向 _run_pdh 显式传 runner 的
PDH 注入用例不受影响（它们不调用 subprocess.run）；需测真实子进程的用例在 body 内覆盖。
"""

import pytest
from qed_engine.services import monitor


@pytest.fixture(autouse=True)
def _stub_pdh_subprocess_for_monitor(monkeypatch):
    """桩 monitor.subprocess.run：模拟 Get-Counter「无 PowerShell」→ _run_pdh 捕获返回空串。"""
    def _raise(cmd, **kwargs):
        raise FileNotFoundError
    monkeypatch.setattr(monitor.subprocess, "run", _raise)
