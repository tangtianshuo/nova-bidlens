import type { CompareResult, DiffItem } from '@bidlens/shared';
import { useMemo, useState } from 'react';

export function ReviewWorkbench({ result }: { result: CompareResult }) {
  const [selectedId, setSelectedId] = useState(result.diffAst.items[0]?.matchId ?? '');
  const selected = useMemo(() => result.diffAst.items.find((item) => item.matchId === selectedId) ?? result.diffAst.items[0], [result.diffAst.items, selectedId]);

  return (
    <main style={{ display: 'grid', gridTemplateColumns: '280px minmax(0, 1fr) 320px', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      <aside style={{ borderRight: '1px solid #ddd', padding: 16, overflow: 'auto' }}>
        <h2 style={{ fontSize: 18 }}>差异导航</h2>
        {result.diffAst.items.map((item) => (
          <button key={item.matchId} onClick={() => setSelectedId(item.matchId)} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 8 }}>
            <span>{item.matchType}</span>
            <span style={{ float: 'right' }}>{item.confidence.toFixed(2)}</span>
          </button>
        ))}
      </aside>
      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: 16, overflow: 'auto' }}>
        <DocumentPane title={result.docA.filename} text={selected?.sourceA ?? ''} />
        <DocumentPane title={result.docB.filename} text={selected?.sourceB ?? ''} />
      </section>
      <aside style={{ borderLeft: '1px solid #ddd', padding: 16 }}>
        {selected ? <DetailPanel item={selected} /> : <p>没有差异</p>}
      </aside>
    </main>
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
  return (
    <section>
      <h2 style={{ fontSize: 18 }}>差异详情</h2>
      <p>{item.matchType}</p>
      <p>confidence {item.confidence.toFixed(2)}</p>
      <p>similarity {item.similarity.toFixed(2)}</p>
      <p>{item.summary}</p>
    </section>
  );
}
