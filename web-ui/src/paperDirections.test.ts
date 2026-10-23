/**
 * 检索方向 → 请求参数映射纯函数测试（REQ-109 I8，REQ-107 壳 §11.2 / S1）
 * - 四方向是界面概念：深度复用 `core`、匹配复用 `frontier`，只用现成字段覆盖，不新增 recipe 值
 * - 一次探索恒 `top=5`（R9 已裁＝推荐上限不展示）
 * - 匹配方向缺探索目标 → 界面拦下、不发请求（8901 允许 goal 空，故拦在根侧）
 * - 深度/匹配的 goal 追加语必须**实际下发**（口径透明：段①摘要与段③都要显示同一串）
 * - 下发值不越 8901 校验边界：limit ≤ 25、years_limit ≥ 0、top ≤ 20
 */
import { describe, it, expect } from 'vitest';
import {
  PAPER_DIRECTIONS, PAPER_TOP_PER_LAUNCH, directionPolicy, composePaperLaunch,
} from './paperDirections';
import type { PaperDirection } from './paperDirections';

const DESC = '高等数学领域的极限、导数与积分';

function launch(direction: PaperDirection, goal: string = '', categories: string[] = []) {
  return composePaperLaunch({
    domainId: 'math-advanced', direction, goal, domainDescription: DESC, categories,
  });
}

describe('四方向的界面构成', () => {
  it('顺序＝前沿／核心／深度／匹配，且每项带选中说明', () => {
    expect(PAPER_DIRECTIONS.map((item) => item.direction))
      .toEqual(['frontier', 'core', 'depth', 'match']);
    expect(PAPER_DIRECTIONS.map((item) => item.label)).toEqual(['前沿', '核心', '深度', '匹配']);
    PAPER_DIRECTIONS.forEach((item) => expect(item.hint.length).toBeGreaterThan(0));
  });

  it('recipe 只落在对方封闭值域内（frontier／core），不新增配方', () => {
    PAPER_DIRECTIONS.forEach((item) => {
      expect(['frontier', 'core']).toContain(item.recipe);
    });
    expect(directionPolicy('depth').recipe).toBe('core');
    expect(directionPolicy('match').recipe).toBe('frontier');
  });
});

describe('映射表逐格（§11.2）', () => {
  it('前沿／核心＝配方缺省：不下发 years_limit 与 limit', () => {
    expect(launch('frontier').body).not.toHaveProperty('years_limit');
    expect(launch('frontier').body).not.toHaveProperty('limit');
    expect(launch('core').body).not.toHaveProperty('years_limit');
    expect(launch('core').body).not.toHaveProperty('limit');
  });

  it('深度＝core + years_limit 0（显式不限年）+ limit 25', () => {
    const body = launch('depth').body!;
    expect(body.recipe).toBe('core');
    expect(body.years_limit).toBe(0);
    expect(body.limit).toBe(25);
  });

  it('匹配＝frontier + years_limit 10 + limit 20', () => {
    const body = launch('match', '级数的收敛判别').body!;
    expect(body.recipe).toBe('frontier');
    expect(body.years_limit).toBe(10);
    expect(body.limit).toBe(20);
  });

  it('四方向都恒 top=5（R9：推荐上限不展示）', () => {
    (['frontier', 'core', 'depth', 'match'] as PaperDirection[]).forEach((direction) => {
      expect(launch(direction, '级数的收敛判别').body!.top).toBe(PAPER_TOP_PER_LAUNCH);
    });
    expect(PAPER_TOP_PER_LAUNCH).toBe(5);
  });

  it('下发值不越 8901 校验边界（limit ≤25、years_limit ≥0、top ≤20）', () => {
    PAPER_DIRECTIONS.forEach((item) => {
      const body = launch(item.direction, '级数的收敛判别').body!;
      expect(body.top).toBeLessThanOrEqual(20);
      if (body.years_limit !== undefined) expect(body.years_limit).toBeGreaterThanOrEqual(0);
      if (body.limit !== undefined) {
        expect(body.limit).toBeGreaterThanOrEqual(1);
        expect(body.limit).toBeLessThanOrEqual(25);
      }
    });
  });

  it('arXiv 分类为空数组时不下发（留空＝按领域关键词映射）', () => {
    expect(launch('frontier').body).not.toHaveProperty('categories');
    expect(launch('frontier', '', ['cs.AI']).body!.categories).toEqual(['cs.AI']);
  });
});

describe('探索目标的组装与如实展示', () => {
  it('前沿／核心：探索目标留空即不下发 goal', () => {
    expect(launch('frontier').body).not.toHaveProperty('goal');
    expect(launch('frontier').effectiveGoal).toBe(DESC);
  });

  it('前沿／核心：填了探索目标就原样下发', () => {
    const body = launch('core', '泰勒展开的证明').body!;
    expect(body.goal).toBe('泰勒展开的证明');
  });

  it('深度：追加语实际进入 goal（留空时以领域描述为基底）', () => {
    const body = launch('depth').body!;
    expect(body.goal).toContain('侧重证明细节、方法论与理论深度');
    expect(body.goal?.startsWith(DESC)).toBe(true);
    expect(launch('depth').effectiveGoal).toBe(body.goal);
  });

  it('深度：有用户目标时追加语接在用户目标之后', () => {
    expect(launch('depth', '一致收敛').body!.goal).toBe('一致收敛，侧重证明细节、方法论与理论深度');
  });

  it('深度：基底以句读结尾时先去掉再衔接（真机取证的「。，侧重」缺陷）', () => {
    expect(launch('depth', '稀疏注意力。').body!.goal)
      .toBe('稀疏注意力，侧重证明细节、方法论与理论深度');
  });

  it('匹配：无追加语，goal 即用户输入', () => {
    expect(launch('match', '勒贝格控制收敛定理').body!.goal).toBe('勒贝格控制收敛定理');
    expect(directionPolicy('match').goalSuffix).toBe('');
  });
});

describe('发起前的界面拦截', () => {
  it('匹配方向缺探索目标 → 给出提示且不产出请求体', () => {
    const r = launch('match');
    expect(r.error).toBe('匹配方向需要填写本次探索目标');
    expect(r.body).toBeNull();
  });

  it('领域编号缺失 → 拦下（论文没有默认桶）', () => {
    const r = composePaperLaunch({
      domainId: '', direction: 'frontier', goal: '', domainDescription: DESC, categories: [],
    });
    expect(r.error).toContain('领域');
    expect(r.body).toBeNull();
  });

  it('只有匹配方向要求探索目标必填', () => {
    expect(directionPolicy('match').goalRequired).toBe(true);
    expect(directionPolicy('depth').goalRequired).toBe(false);
  });
});
