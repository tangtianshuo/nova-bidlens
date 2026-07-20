import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { ProjectNameField } from './project-name-field';
import { TenderBaselineSlot } from './tender-baseline-slot';

interface BaselineFile {
  name: string;
  format: string;
  sizeBytes: number;
}

export interface NewProjectFormData {
  name: string;
  baseline: BaselineFile | null;
}

interface NewProjectPageProps {
  onSubmit?: (data: NewProjectFormData) => void;
}

export function NewProjectPage({ onSubmit }: NewProjectPageProps) {
  const [name, setName] = useState('');
  const [baseline, setBaseline] = useState<BaselineFile | null>(null);

  const canSubmit = name.trim().length >= 2;

  const handleSubmit = useCallback(() => {
    if (!canSubmit) return;
    onSubmit?.({ name: name.trim(), baseline });
  }, [canSubmit, name, baseline, onSubmit]);

  return (
    <div
      className="flex min-h-full flex-col"
      style={{ maxWidth: 1120, padding: '34px 36px 28px' }}
    >
      {/* Page Head */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--color-text)]">
          新建项目
        </h1>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          配置项目信息后添加投标文件
        </p>
      </div>

      {/* Form Fields */}
      <div className="flex max-w-lg flex-col gap-6">
        <ProjectNameField value={name} onChange={setName} />

        <TenderBaselineSlot value={baseline} onChange={setBaseline} />

        {/* Placeholder for submission file slots (UI-204) */}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-[var(--color-text)]">
            投标文件
          </span>
          <div className="flex min-h-[120px] items-center justify-center rounded-[var(--radius)] border border-dashed border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            投标文件将在下一步添加
          </div>
        </div>
      </div>

      {/* Page Actions */}
      <div className="mt-auto flex items-center gap-2.5 pt-6">
        {!canSubmit && (
          <span className="mr-auto text-xs text-[var(--color-text-muted)]">
            请输入项目名称后继续
          </span>
        )}
        <Button
          variant="primary"
          size="md"
          disabled={!canSubmit}
          onClick={handleSubmit}
        >
          下一步
        </Button>
      </div>
    </div>
  );
}
