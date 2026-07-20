import { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { ProjectNameField } from './project-name-field';
import { TenderBaselineSlot } from './tender-baseline-slot';
import { SubmissionFileList, validateFiles, type SubmissionFile } from './submission-file-list';
import { DetectionPreset, type DetectionPresetId } from './detection-preset';

interface BaselineFile {
  name: string;
  format: string;
  sizeBytes: number;
}

export interface NewProjectFormData {
  name: string;
  baseline: BaselineFile | null;
  submissions: SubmissionFile[];
  preset: DetectionPresetId;
}

interface NewProjectPageProps {
  onSubmit?: (data: NewProjectFormData) => void;
  onStartAnalysis?: (data: NewProjectFormData) => void;
}

type FormStep = 'configure' | 'review';

export function NewProjectPage({ onSubmit, onStartAnalysis }: NewProjectPageProps) {
  const [name, setName] = useState('');
  const [baseline, setBaseline] = useState<BaselineFile | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionFile[]>([]);
  const [preset, setPreset] = useState<DetectionPresetId>('standard');
  const [step, setStep] = useState<FormStep>('configure');

  const fileErrors = useMemo(() => validateFiles(submissions), [submissions]);
  const blockingErrors = fileErrors.filter((e) => e.type !== 'duplicate' || submissions.length > 1);
  const canProceed = name.trim().length >= 2 && submissions.length >= 2 && blockingErrors.length === 0;

  const handleConfigureSubmit = useCallback(() => {
    if (!canProceed) return;
    onSubmit?.({ name: name.trim(), baseline, submissions, preset });
    setStep('review');
  }, [canProceed, name, baseline, submissions, preset, onSubmit]);

  const handleStartAnalysis = useCallback(() => {
    onStartAnalysis?.({ name: name.trim(), baseline, submissions, preset });
  }, [name, baseline, submissions, preset, onStartAnalysis]);

  if (step === 'review') {
    return (
      <DetectionPreset
        value={preset}
        onChange={setPreset}
        onStartAnalysis={handleStartAnalysis}
        canStart={canProceed}
        startDisabledReason={blockingErrors.length > 0 ? '文件验证未通过' : undefined}
        submissionCount={submissions.length}
        hasBaseline={baseline !== null}
      />
    );
  }

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

        <SubmissionFileList
          files={submissions}
          onChange={setSubmissions}
        />
      </div>

      {/* Page Actions */}
      <div className="mt-auto flex items-center gap-2.5 pt-6">
        {!canProceed && (
          <span className="mr-auto text-xs text-[var(--color-text-muted)]">
            {name.trim().length < 2
              ? '请输入项目名称后继续'
              : submissions.length < 2
                ? '请添加至少 2 个投标文件'
                : '请修正文件错误后继续'}
          </span>
        )}
        <Button
          variant="primary"
          size="md"
          disabled={!canProceed}
          onClick={handleConfigureSubmit}
        >
          下一步
        </Button>
      </div>
    </div>
  );
}
