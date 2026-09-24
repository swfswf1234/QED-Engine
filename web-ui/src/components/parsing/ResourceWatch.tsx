/**
 * 解析页资源监控弹窗（2026-09-23 用户加需）：轮询 8900 `/monitor/gpu` + `/models/vision`。
 * - 显存占用 ≥95% → 常驻「显存占用过高」警告弹窗，<90% 撤下并复位（迟滞防抖）；
 * - vision 槽 `health_state=down` → 「本地模型服务中断」错误弹窗，按 `last_flip` 每事故只弹一次。
 * 轮询失败静默（8900 离线由页面全局横幅承接）；纯弹窗不占版面。
 */
import { useEffect, useRef } from 'react';
import { App } from 'antd';
import { monitorGpu } from '../../api/services';
import { getSlotStatus } from '../../api/llm';

const VRAM_WARN = 0.95;
const VRAM_CLEAR = 0.9;
const VRAM_KEY = 'resource-vram';
const MODEL_KEY = 'resource-model-down';

export interface ResourceWatchProps {
  /** 轮询间隔（默认 10s；测试注入短间隔） */
  intervalMs?: number;
}

export default function ResourceWatch({ intervalMs = 10000 }: ResourceWatchProps) {
  const { notification } = App.useApp();
  const vramArmed = useRef(true);
  const downFlip = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const [gpu, vision] = await Promise.all([
        monitorGpu().catch(() => null),
        getSlotStatus('vision').catch(() => null),
      ]);
      if (cancelled) return;
      const total = gpu?.available ? gpu.memory_total_mb ?? 0 : 0;
      if (gpu && total > 0) {
        const percent = (gpu.memory_used_mb ?? 0) / total;
        if (percent >= VRAM_WARN && vramArmed.current) {
          vramArmed.current = false;
          notification.warning({
            key: VRAM_KEY,
            duration: 0,
            message: `显存占用过高（${Math.round(percent * 100)}%）`,
            description: '请关闭高显存程序（游戏等）后再继续解析；显存挤压可能导致本地模型服务被打挂、解析任务失败。',
          });
        } else if (percent < VRAM_CLEAR && !vramArmed.current) {
          vramArmed.current = true;
          notification.destroy(VRAM_KEY);
        }
      }
      if (vision) {
        if (vision.health_state === 'down') {
          const flip = vision.last_flip ?? '';
          if (downFlip.current !== flip) {
            downFlip.current = flip;
            notification.error({
              key: MODEL_KEY,
              duration: 0,
              message: '本地模型服务中断',
              description: `${vision.health_reason || '模型探针失败'}${vision.last_flip ? `（发生 ${vision.last_flip}）` : ''}。进行中的解析任务会逐页失败；请在管理控制台重启模型后，对失败页重新提交解析。`,
            });
          }
        } else if (downFlip.current !== null) {
          downFlip.current = null;
          notification.destroy(MODEL_KEY);
        }
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), intervalMs);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [notification, intervalMs]);

  return null;
}
