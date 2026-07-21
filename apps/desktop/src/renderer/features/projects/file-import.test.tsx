import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, afterEach } from 'vitest';
import { SubmissionFileList, validateFiles, type SubmissionFile } from './file-import';

afterEach(cleanup);

function makeFile(overrides: Partial<SubmissionFile> = {}): SubmissionFile {
  return {
    id: `file-${Math.random().toString(36).slice(2, 8)}`,
    name: '投标文件.docx',
    format: 'docx',
    sizeBytes: 2_500_000,
    pageCount: 120,
    sha256: 'a'.repeat(64),
    ...overrides,
  };
}

describe('FileImport (V3-221)', () => {
  it('renders drop zone with upload prompt', () => {
    render(<SubmissionFileList files={[]} onChange={() => {}} />);
    expect(screen.getByText(/拖放投标文件到此处/)).toBeTruthy();
    expect(screen.getByText(/支持 .docx 和文字版 .pdf/)).toBeTruthy();
  });

  it('shows file list after selection', () => {
    const files = [
      makeFile({ id: 'f1', name: 'A公司.docx', format: 'docx', sizeBytes: 2_500_000, sha256: 'a'.repeat(64) }),
      makeFile({ id: 'f2', name: 'B公司.pdf', format: 'pdf', sizeBytes: 1_800_000, sha256: 'b'.repeat(64) }),
    ];
    render(<SubmissionFileList files={files} onChange={() => {}} />);
    expect(screen.getByText('A公司.docx')).toBeTruthy();
    expect(screen.getByText('B公司.pdf')).toBeTruthy();
    expect(screen.getByText('DOCX')).toBeTruthy();
    expect(screen.getByText('PDF')).toBeTruthy();
  });

  it('rejects < 2 files with validation error', () => {
    const files = [makeFile({ id: 'f1', sha256: 'a'.repeat(64) })];
    const errors = validateFiles(files);
    expect(errors.some((e) => e.type === 'count' && e.message.includes('至少'))).toBe(true);
  });

  it('rejects > 8 files with validation error', () => {
    const files = Array.from({ length: 9 }, (_, i) =>
      makeFile({ id: `f${i}`, sha256: String(i).padStart(64, '0') }),
    );
    const errors = validateFiles(files, 2, 8);
    expect(errors.some((e) => e.type === 'count' && e.message.includes('最多'))).toBe(true);
  });

  it('detects duplicates by sha256', () => {
    const files = [
      makeFile({ id: 'f1', name: 'A.docx', sha256: 'same'.padEnd(64, '0') }),
      makeFile({ id: 'f2', name: 'B.docx', sha256: 'same'.padEnd(64, '0') }),
    ];
    const errors = validateFiles(files);
    const dupErrors = errors.filter((e) => e.type === 'duplicate');
    expect(dupErrors).toHaveLength(2);
    expect(dupErrors[0].message).toContain('A.docx');
    expect(dupErrors[0].message).toContain('B.docx');
  });

  it('shows duplicate badge in file list', () => {
    const files = [
      makeFile({ id: 'f1', name: 'A.docx', sha256: 'same'.padEnd(64, '0') }),
      makeFile({ id: 'f2', name: 'B.docx', sha256: 'same'.padEnd(64, '0') }),
    ];
    render(<SubmissionFileList files={files} onChange={() => {}} />);
    const dupes = screen.getAllByText('重复');
    expect(dupes.length).toBeGreaterThanOrEqual(2);
  });

  it('shows blocking error when fewer than 2 files', () => {
    const files = [makeFile({ id: 'f1', sha256: 'a'.repeat(64) })];
    render(<SubmissionFileList files={files} onChange={() => {}} />);
    expect(screen.getByRole('alert').textContent).toContain('至少需要');
  });

  it('shows file count and total size', () => {
    const files = [
      makeFile({ id: 'f1', sizeBytes: 2_500_000, sha256: 'a'.repeat(64) }),
      makeFile({ id: 'f2', sizeBytes: 3_000_000, sha256: 'b'.repeat(64) }),
    ];
    render(<SubmissionFileList files={files} onChange={() => {}} />);
    expect(screen.getByText(/2\/8 个文件/)).toBeTruthy();
  });

  it('calls onChange with file removed when X clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const files = [
      makeFile({ id: 'f1', name: 'A.docx', sha256: 'a'.repeat(64) }),
      makeFile({ id: 'f2', name: 'B.docx', sha256: 'b'.repeat(64) }),
    ];
    render(<SubmissionFileList files={files} onChange={onChange} />);
    await user.click(screen.getByLabelText(/移除 A.docx/));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 'f2' }),
    ]);
  });

  it('hides add button when at max files', () => {
    const files = Array.from({ length: 8 }, (_, i) =>
      makeFile({ id: `f${i}`, sha256: String(i).padStart(64, '0') }),
    );
    render(<SubmissionFileList files={files} onChange={() => {}} />);
    expect(screen.queryByText('添加文件')).toBeNull();
  });

  it('validates unsupported format', () => {
    const files = [
      makeFile({ id: 'f1', format: 'docx' as any, sha256: 'a'.repeat(64) }),
      makeFile({ id: 'f2', format: 'doc' as any, sha256: 'b'.repeat(64) }),
    ];
    const errors = validateFiles(files);
    expect(errors.some((e) => e.type === 'format' && e.fileId === 'f2')).toBe(true);
  });

  it('validates oversized file', () => {
    const files = [
      makeFile({ id: 'f1', sizeBytes: 200 * 1024 * 1024, sha256: 'a'.repeat(64) }),
      makeFile({ id: 'f2', sizeBytes: 1000, sha256: 'b'.repeat(64) }),
    ];
    const errors = validateFiles(files);
    expect(errors.some((e) => e.type === 'size' && e.fileId === 'f1')).toBe(true);
  });

  it('returns no errors for a valid 3-file set', () => {
    const files = [
      makeFile({ id: 'f1', sha256: 'a'.repeat(64) }),
      makeFile({ id: 'f2', sha256: 'b'.repeat(64) }),
      makeFile({ id: 'f3', sha256: 'c'.repeat(64) }),
    ];
    expect(validateFiles(files)).toEqual([]);
  });
});
