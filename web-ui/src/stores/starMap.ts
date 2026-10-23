/**
 * 知识探索·星图 store（M5 demo）
 * - 数据源：GET /learn/star-map（一次取全域，领域切换本地过滤，不重复请求）
 * - 星图布局不依赖知识点表：新表未接入时计数为 0，仍出图
 * - 降级：8900/目录不可达 → error + 重试，不白屏
 */
import { create } from 'zustand';
import { getStarMap, type StarMapDomain, type StarMapEdge } from '../api/learn';
import { describeError } from '../api/client';

export interface StarMapStore {
  domains: StarMapDomain[];
  edges: StarMapEdge[];
  /** 选中领域 domain_id（'' = 未初始化，拉取后默认第一个领域） */
  domainId: string;
  loading: boolean;
  error: string | null;
  fetchStarMap: () => Promise<void>;
  selectDomain: (domainId: string) => void;
}

export const useStarMapStore = create<StarMapStore>((set, get) => ({
  domains: [],
  edges: [],
  domainId: '',
  loading: false,
  error: null,

  fetchStarMap: async () => {
    if (get().loading) return;
    set({ loading: true });
    try {
      const body = await getStarMap();
      const domains = body.domains;
      const current = get().domainId;
      const keep = domains.some((d) => d.domain_id === current);
      set({
        domains,
        edges: body.edges,
        domainId: keep ? current : domains[0]?.domain_id ?? '',
        error: null,
      });
    } catch (err) {
      set({ error: describeError(err) });
    } finally {
      set({ loading: false });
    }
  },

  selectDomain: (domainId) => set({ domainId }),
}));

/** 当前选中领域的星图数据（无数据 → null） */
export function currentDomain(store: Pick<StarMapStore, 'domains' | 'domainId'>): StarMapDomain | null {
  return store.domains.find((d) => d.domain_id === store.domainId) ?? store.domains[0] ?? null;
}
