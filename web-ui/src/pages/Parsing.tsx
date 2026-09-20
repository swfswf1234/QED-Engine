/**
 * 文档解析管理（`#/admin/parsing`，2026-09-20 G 轮单屏回调）
 * 单屏「左书目树（纯选择）+ 右对照」：BookTree lg=5 ｜ ParseToolbar + CompareView lg=19。
 * - URL hash `?book=<id>&page=<n>` 双向同步（刷新/书签恢复）
 * - 键盘 ←/→ 翻页（输入控件/弹层聚焦时跳过）
 * 设计：docs/design/parsing-ui.md
 */
import { useCallback, useEffect } from 'react';
import { Alert, Button, Col, Empty, Layout, Row, Tooltip, Typography } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useSearchParams } from 'react-router-dom';
import BookTree from '../components/parsing/BookTree';
import CompareView, { blocksOf } from '../components/parsing/CompareView';
import ParseToolbar from '../components/parsing/ParseToolbar';
import { describeError } from '../api/client';
import { useParsingStore } from '../stores/parsing';

const { Title } = Typography;

export default function Parsing() {
  const compareBook = useParsingStore((s) => s.compareBook);
  const compareBookId = useParsingStore((s) => s.compareBookId);
  const comparePageNo = useParsingStore((s) => s.comparePageNo);
  const pages = useParsingStore((s) => s.pages);
  const scrollMode = useParsingStore((s) => s.scrollMode);
  const syncScroll = useParsingStore((s) => s.syncScroll);
  const zoom = useParsingStore((s) => s.zoom);
  const renderMode = useParsingStore((s) => s.renderMode);
  const gotoPage = useParsingStore((s) => s.gotoPage);
  const booksLoading = useParsingStore((s) => s.booksLoading);
  const treeLoading = useParsingStore((s) => s.treeLoading);
  const error = useParsingStore((s) => s.error);
  const dataError = useParsingStore((s) => s.dataError);
  const syncing = useParsingStore((s) => s.syncing);
  const syncMessage = useParsingStore((s) => s.syncMessage);
  const syncError = useParsingStore((s) => s.syncError);
  const fetchBooks = useParsingStore((s) => s.fetchBooks);
  const fetchTree = useParsingStore((s) => s.fetchTree);

  const [params, setParams] = useSearchParams();

  // 进入界面：拉树 + 书目列表；URL 带 book 则恢复到对照原页
  useEffect(() => {
    void fetchTree();
    void fetchBooks(false);
    const book = params.get('book');
    if (book) void useParsingStore.getState().openWorkbench(book, Number(params.get('page')) || 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // store → URL（选中书目带 book/page；未选中清空）。params 入依赖：
  // 挂载首帧清参竞态由下一帧自动写回（自愈）。
  useEffect(() => {
    if (compareBookId) {
      if (params.get('book') !== compareBookId || params.get('page') !== String(comparePageNo)) {
        setParams({ book: compareBookId, page: String(comparePageNo) }, { replace: true });
      }
    } else if (params.size > 0) {
      setParams({}, { replace: true });
    }
  }, [compareBookId, comparePageNo, params, setParams]);

  // 键盘 ←/→ 翻页（输入控件/弹层聚焦时跳过）
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const s = useParsingStore.getState();
      if (!s.compareBookId) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      if (el?.closest('.ant-popover')) return;
      if (e.key === 'ArrowLeft') gotoPage(-1);
      else if (e.key === 'ArrowRight') gotoPage(1);
    },
    [gotoPage],
  );
  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);

  // 刷新 = 同步书目（POST /books/sync → GET /books）后重拉树
  const onRefresh = useCallback(async () => {
    await fetchBooks(true);
    await fetchTree();
  }, [fetchBooks, fetchTree]);

  const entry = compareBookId ? pages[comparePageNo] : undefined;
  const blocks = entry?.data ? blocksOf(entry.data) : [];

  return (
    <Layout.Content style={{ padding: 24, maxWidth: 2400, width: '98%', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={2} style={{ margin: 0 }}>文档解析管理</Title>
        {/* 单一「刷新」按钮（G 轮裁决：同步书目并入，不再单列按钮） */}
        <Tooltip title="同步书目（8901）并重拉树与书目数据；同步失败不阻塞查看">
          <Button icon={<ReloadOutlined />} loading={syncing || treeLoading || booksLoading} onClick={() => void onRefresh()}>刷新</Button>
        </Tooltip>
      </div>

      {error && (
        <Alert
          type="error" showIcon style={{ marginBottom: 16 }}
          message="解析数据获取失败"
          description={`${describeError(error)}。请确认 8900 管理服务已启动后点「刷新」。`}
        />
      )}
      {!error && dataError && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message="Axiom-Flow 数据不可达"
          description={`${describeError(dataError)}。8902 离线时仍显示领域和课程，书目暂不可用。`}
        />
      )}
      {syncMessage && !dataError && <Alert type="success" showIcon style={{ marginBottom: 16 }} message={syncMessage} />}
      {syncError && (
        <Alert
          type="warning" showIcon style={{ marginBottom: 16 }}
          message="书目同步未完成"
          description={`${describeError(syncError)}。同步失败不阻塞查看已同步书目。`}
        />
      )}

      <Row gutter={16}>
        <Col xs={24} lg={5}>
          <BookTree />
        </Col>
        <Col xs={24} lg={19}>
          {!compareBookId && (
            <Empty description="从左侧书目树选择一本书，开始原文与解析文档对照" style={{ marginTop: 60 }} />
          )}
          {compareBookId && !compareBook && <div role="status" aria-label="工作台加载中">书目信息加载中…</div>}
          {compareBook && (
            <>
              <ParseToolbar book={compareBook} pageNo={comparePageNo} blockCount={blocks.length} />
              <CompareView
                book={compareBook}
                pageNo={comparePageNo}
                entry={entry}
                scrollMode={scrollMode}
                syncScroll={syncScroll}
                zoom={zoom}
                renderMode={renderMode}
              />
            </>
          )}
        </Col>
      </Row>
    </Layout.Content>
  );
}
