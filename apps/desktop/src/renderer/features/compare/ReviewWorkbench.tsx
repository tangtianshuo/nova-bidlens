import type { CompareResult, DiffItem } from '@bidlens/shared';
import { isTableDiffItem } from '@bidlens/shared';
import { useMemo, useState } from 'react';
import { TableDiffView } from '../../components/TableDiffView';

export function ReviewWorkbench({ result }: { result: CompareResult }) {
  const [selectedId, setSelectedId] = useState(result.diffAst.items[0]?.matchId ?? '');
  const selected = useMemo(() => result.diffAst.items.find((item) => item.matchId === selectedId) ?? result.diffAst.items[0], [result.diffAst.items, selectedId]);

  const handleCellClick = (position: [number, number]) => {
    console.log('Cell clicked:', position);
    // Could implement navigation to specific cell in detail panel
  };

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 320px', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <aside style={{ borderRight: '1px solid #ddd', padding: 16, overflow: 'auto' }}>
        <h2 style={{ fontSize: 18 }}>差异导航</h2>
        {result.diffAst.items.map((item) => (
          <button
            key={item.matchId}
            onClick={() => setSelectedId(item.matchId)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              marginBottom: 8,
              padding: '8px',
              backgroundColor: item.matchId === selectedId ? '#e9ecef' : 'transparent',
              border: '1px solid #ddd',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            <span>{item.matchType}</span>
            {item.blockType === 'table' && (
              <span style={{ marginLeft: '4px', fontSize: '12px', color: '#666' }}>📊</span>
            )}
            <span style={{ float: 'right' }}>{item.confidence.toFixed(2)}</span>
          </button>
        ))}
      </aside>

      <section style={{ padding: 16, overflow: 'auto' }}>
        {selected && isTableDiffItem(selected) ? (
          <TableDiffContent item={selected} onCellClick={handleCellClick} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <DocumentPane title={result.docA.filename} text={selected?.sourceA ?? ''} />
            <DocumentPane title={result.docB.filename} text={selected?.sourceB ?? ''} />
          </div>
        )}
      </section>

      <aside style={{ borderLeft: '1px solid #ddd', padding: 16 }}>
        {selected ? <DetailPanel item={selected} /> : <p>没有差异</p>}
      </aside>
    </main>
  );
}

function TableDiffContent({ item, onCellClick }: { item: DiffItem; onCellClick: (position: [number, number]) => void }) {
  if (!item.tableA || !item.tableB || !item.tableDiff) {
    return <p>表格数据不完整</p>;
  }

  return (
    <TableDiffView
      tableA={item.tableA}
      tableB={item.tableB}
      diffResult={item.tableDiff}
      onCellClick={onCellClick}
    />
  );
}

function DocumentPane({ title, text }: { title: string; text: string }) {
  return (
    <article>
      <h2 style={{ fontSize: 18 }}>{title}</h2>
      <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{text}</p>
    </article>
  );
}

function DetailPanel({ item }: { item: DiffItem }) {
  const isTable = isTableDiffItem(item);

  return (
    <section>
      <h2 style={{ fontSize: 18 }}>差异详情</h2>
      <p>{item.matchType}</p>
      <p>confidence {item.confidence.toFixed(2)}</p>
      <p>similarity {item.similarity.toFixed(2)}</p>
      <p>{item.summary}</p>

      {isTable && item.tableDiff && (
        <div style={{ marginTop: '16px', padding: '12px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
          <h3 style={{ fontSize: '14px', marginBottom: '8px' }}>表格差异统计</h3>
          <p>表格匹配类型: {item.tableDiff.tableMatchType}</p>
          <p>差异单元格数: {item.tableDiff.cellDiffs.length}</p>
          <p>结构变化: {item.tableDiff.structuralChanges.length}</p>
          {item.tableDiff.structuralChanges.length > 0 && (
            <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
              {item.tableDiff.structuralChanges.map((change, idx) => (
                <li key={idx}>{formatStructuralChange(change)}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}

function formatStructuralChange(change: { type: string; count: number; position: number }): string {
  switch (change.type) {
    case 'rows_added':
      return '新增 ' + change.count + ' 行';
    case 'rows_deleted':
      return '删除 ' + change.count + ' 行';
    case 'columns_added':
      return '新增 ' + change.count + ' 列';
    case 'columns_deleted':
      return '删除 ' + change.count + ' 列';
    default:
      return '';
  }
}
