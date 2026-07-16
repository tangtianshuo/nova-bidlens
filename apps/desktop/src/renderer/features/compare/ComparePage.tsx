import type { CompareResult } from '@bidlens/shared';
import { useState } from 'react';
import { ReviewWorkbench } from './ReviewWorkbench';

export function ComparePage() {
  const [result, setResult] = useState<CompareResult | null>(null);

  if (result) return <ReviewWorkbench result={result} />;

  return (
    <main style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h1>BidLens</h1>
      <button onClick={() => void startDemoCompare(setResult)} style={{ height: 36, padding: '0 12px' }}>
        打开示例比对
      </button>
    </main>
  );
}

async function startDemoCompare(setResult: (result: CompareResult) => void): Promise<void> {
  const started = await window.bidlens.startCompare({
    fileAPath: 'demo-a.docx',
    fileBPath: 'demo-b.docx',
    options: { mode: 'standard', embeddingProvider: 'local', embeddingModel: 'test', topK: 5, similarityThreshold: 0.45 }
  });
  setResult(await window.bidlens.getCompareResult(started.taskId));
}
