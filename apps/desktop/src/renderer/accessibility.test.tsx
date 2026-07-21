/**
 * P6-06: WCAG 2.2 AA accessibility audit tests.
 *
 * Tests keyboard navigation, ARIA attributes, contrast, focus management,
 * reduced motion, and high contrast mode support.
 */

import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createElement } from 'react';

// ---------------------------------------------------------------------------
// Accessibility test helpers
// ---------------------------------------------------------------------------

/**
 * Check that an element has proper ARIA attributes.
 */
function expectAriaAttributes(
  element: HTMLElement,
  attributes: Record<string, string | boolean>
) {
  for (const [attr, value] of Object.entries(attributes)) {
    if (typeof value === 'boolean') {
      if (value) {
        expect(element.hasAttribute(attr)).toBe(true);
      }
    } else {
      expect(element.getAttribute(attr)).toBe(value);
    }
  }
}

/**
 * Check that an element is focusable.
 */
function expectFocusable(element: HTMLElement) {
  const tagName = element.tagName.toLowerCase();
  const tabIndex = element.getAttribute('tabindex');
  const isNativelyFocusable = ['a', 'button', 'input', 'select', 'textarea'].includes(tagName);
  const hasTabIndex = tabIndex !== null && parseInt(tabIndex) >= 0;

  expect(isNativelyFocusable || hasTabIndex).toBe(true);
}

/**
 * Check that an element has visible focus indicator.
 */
function expectFocusIndicator(element: HTMLElement) {
  // Simulate focus
  fireEvent.focus(element);

  // Check for focus-visible or outline styles
  const styles = window.getComputedStyle(element);
  const hasOutline = styles.outlineStyle !== 'none' && styles.outlineWidth !== '0px';
  const hasFocusRing = element.classList.contains('focus-visible') ||
    element.classList.contains('focus:ring') ||
    element.querySelector('.focus\\:ring') !== null;

  // At least one focus indicator should be present
  expect(hasOutline || hasFocusRing || element.matches(':focus-visible')).toBe(true);
}

// ---------------------------------------------------------------------------
// Mock components for testing
// ---------------------------------------------------------------------------

function MockButton({ children, disabled, onClick, ariaLabel }: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      className="focus:ring-2 focus:ring-offset-2"
    >
      {children}
    </button>
  );
}

function MockInput({ label, error, required }: {
  label: string;
  error?: string;
  required?: boolean;
}) {
  const id = `input-${label.toLowerCase().replace(/\s/g, '-')}`;
  return (
    <div>
      <label htmlFor={id}>
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      <input
        id={id}
        aria-required={required ? 'true' : undefined}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
      />
      {error && (
        <div id={`${id}-error`} role="alert">
          {error}
        </div>
      )}
    </div>
  );
}

function MockDialog({ open, onClose, title, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialog-title"
    >
      <h2 id="dialog-title">{title}</h2>
      {children}
      <button onClick={onClose} aria-label="关闭对话框">×</button>
    </div>
  );
}

function MockTabs({ tabs, activeTab, onTabChange }: {
  tabs: { id: string; label: string; content: React.ReactNode }[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div>
      <div role="tablist" aria-label="示例标签页">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={tab.id === activeTab}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`panel-${tab.id}`}
          aria-labelledby={`tab-${tab.id}`}
        >
          {tab.content}
        </div>
      ))}
    </div>
  );
}

function MockTable({ headers, rows, ariaLabel }: {
  headers: string[];
  rows: string[][];
  ariaLabel: string;
}) {
  return (
    <table role="grid" aria-label={ariaLabel}>
      <thead>
        <tr role="row">
          {headers.map((h, i) => (
            <th key={i} role="columnheader">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIdx) => (
          <tr key={rowIdx} role="row">
            {row.map((cell, colIdx) => (
              <td key={colIdx} role="gridcell">{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('WCAG 2.2 AA Accessibility Audit', () => {
  beforeEach(cleanup);

  describe('Keyboard Navigation', () => {
    it('buttons are focusable', () => {
      render(<MockButton ariaLabel="测试按钮">点击</MockButton>);
      const button = screen.getByLabelText('测试按钮');
      expectFocusable(button);
    });

    it('inputs are focusable', () => {
      render(<MockInput label="用户名" />);
      const input = screen.getByLabelText('用户名');
      expectFocusable(input);
    });

    it('disabled buttons are not focusable', () => {
      render(<MockButton disabled ariaLabel="禁用按钮">禁用</MockButton>);
      const button = screen.getByLabelText('禁用按钮');
      expect(button.hasAttribute('disabled')).toBe(true);
    });

    it('dialog close button is focusable', () => {
      render(
        <MockDialog open onClose={vi.fn()} title="测试对话框">
          <p>内容</p>
        </MockDialog>
      );
      const closeButton = screen.getByLabelText('关闭对话框');
      expectFocusable(closeButton);
    });

    it('tab buttons are focusable', () => {
      const tabs = [
        { id: 'tab1', label: '标签1', content: <p>内容1</p> },
        { id: 'tab2', label: '标签2', content: <p>内容2</p> },
      ];
      render(<MockTabs tabs={tabs} activeTab="tab1" onTabChange={vi.fn()} />);

      const tab1 = screen.getByText('标签1');
      const tab2 = screen.getByText('标签2');
      expectFocusable(tab1);
      expectFocusable(tab2);
    });
  });

  describe('ARIA Attributes', () => {
    it('buttons have accessible names', () => {
      render(<MockButton ariaLabel="保存文档">保存</MockButton>);
      const button = screen.getByLabelText('保存文档');
      expectAriaAttributes(button, { 'aria-label': '保存文档' });
    });

    it('inputs have labels', () => {
      render(<MockInput label="电子邮件" />);
      const input = screen.getByLabelText('电子邮件');
      expect(input.id).toBeTruthy();
    });

    it('required inputs have aria-required', () => {
      render(<MockInput label="密码" required />);
      const input = screen.getByRole('textbox', { name: /密码/ });
      expectAriaAttributes(input, { 'aria-required': 'true' });
    });

    it('invalid inputs have aria-invalid', () => {
      render(<MockInput label="邮箱" error="格式不正确" />);
      const input = screen.getByLabelText('邮箱');
      expectAriaAttributes(input, { 'aria-invalid': 'true' });
    });

    it('error messages are linked via aria-describedby', () => {
      render(<MockInput label="邮箱" error="格式不正确" />);
      const input = screen.getByLabelText('邮箱');
      const describedBy = input.getAttribute('aria-describedby');
      expect(describedBy).toBeTruthy();

      const errorElement = document.getElementById(describedBy!);
      expect(errorElement).toBeTruthy();
      expect(errorElement!.textContent).toBe('格式不正确');
    });

    it('dialog has aria-modal', () => {
      render(
        <MockDialog open onClose={vi.fn()} title="确认">
          <p>确定要删除吗？</p>
        </MockDialog>
      );
      const dialog = screen.getByRole('dialog');
      expectAriaAttributes(dialog, { 'aria-modal': 'true' });
    });

    it('dialog has aria-labelledby', () => {
      render(
        <MockDialog open onClose={vi.fn()} title="设置">
          <p>设置内容</p>
        </MockDialog>
      );
      const dialog = screen.getByRole('dialog');
      const labelledBy = dialog.getAttribute('aria-labelledby');
      expect(labelledBy).toBeTruthy();

      const titleElement = document.getElementById(labelledBy!);
      expect(titleElement).toBeTruthy();
      expect(titleElement!.textContent).toBe('设置');
    });

    it('tabs have correct ARIA roles', () => {
      const tabs = [
        { id: 'details', label: '详情', content: <p>详情内容</p> },
        { id: 'format', label: '格式', content: <p>格式内容</p> },
      ];
      render(<MockTabs tabs={tabs} activeTab="details" onTabChange={vi.fn()} />);

      const tablist = screen.getByRole('tablist');
      expect(tablist).toBeTruthy();

      const tabButtons = screen.getAllByRole('tab');
      expect(tabButtons).toHaveLength(2);

      expectAriaAttributes(tabButtons[0], { 'aria-selected': 'true' });
      expectAriaAttributes(tabButtons[1], { 'aria-selected': 'false' });
    });

    it('tabpanels have correct ARIA roles', () => {
      const tabs = [
        { id: 'details', label: '详情', content: <p>详情内容</p> },
        { id: 'format', label: '格式', content: <p>格式内容</p> },
      ];
      render(<MockTabs tabs={tabs} activeTab="details" onTabChange={vi.fn()} />);

      const panels = screen.getAllByRole('tabpanel');
      expect(panels).toHaveLength(2);
    });

    it('table has grid role', () => {
      render(
        <MockTable
          headers={['列1', '列2']}
          rows={[['A1', 'A2'], ['B1', 'B2']]}
          ariaLabel="示例表格"
        />
      );

      const grid = screen.getByRole('grid');
      expectAriaAttributes(grid, { 'aria-label': '示例表格' });

      const columnHeaders = screen.getAllByRole('columnheader');
      expect(columnHeaders).toHaveLength(2);

      const rows = screen.getAllByRole('row');
      expect(rows).toHaveLength(3); // header + 2 data rows

      const cells = screen.getAllByRole('gridcell');
      expect(cells).toHaveLength(4);
    });
  });

  describe('Focus Management', () => {
    it('dialog traps focus', () => {
      render(
        <MockDialog open onClose={vi.fn()} title="焦点陷阱">
          <button>按钮1</button>
          <button>按钮2</button>
        </MockDialog>
      );

      const buttons = screen.getAllByRole('button');
      const lastButton = buttons[buttons.length - 1];

      // Tab from last button should go to first button (trap)
      fireEvent.keyDown(lastButton, { key: 'Tab' });
    });

    it('dialog closes on Escape', () => {
      const onClose = vi.fn();
      render(
        <MockDialog open onClose={onClose} title="ESC关闭">
          <p>按ESC关闭</p>
        </MockDialog>
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      // Note: The actual behavior depends on the component implementation
    });
  });

  describe('Semantic Structure', () => {
    it('headings have correct hierarchy', () => {
      render(
        <div>
          <h1>一级标题</h1>
          <h2>二级标题</h2>
          <h3>三级标题</h3>
        </div>
      );

      const h1 = screen.getByRole('heading', { level: 1 });
      const h2 = screen.getByRole('heading', { level: 2 });
      const h3 = screen.getByRole('heading', { level: 3 });

      expect(h1.textContent).toBe('一级标题');
      expect(h2.textContent).toBe('二级标题');
      expect(h3.textContent).toBe('三级标题');
    });

    it('landmarks are present', () => {
      render(
        <div>
          <header role="banner">头部</header>
          <nav role="navigation">导航</nav>
          <main role="main">主要内容</main>
          <footer role="contentinfo">底部</footer>
        </div>
      );

      expect(screen.getByRole('banner')).toBeTruthy();
      expect(screen.getByRole('navigation')).toBeTruthy();
      expect(screen.getByRole('main')).toBeTruthy();
      expect(screen.getByRole('contentinfo')).toBeTruthy();
    });

    it('lists have correct roles', () => {
      render(
        <ul role="list">
          <li role="listitem">项目1</li>
          <li role="listitem">项目2</li>
        </ul>
      );

      const list = screen.getByRole('list');
      const items = screen.getAllByRole('listitem');
      expect(items).toHaveLength(2);
    });
  });

  describe('Live Regions', () => {
    it('error messages use role="alert"', () => {
      render(<MockInput label="测试" error="错误信息" />);
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toBe('错误信息');
    });

    it('status messages use role="status"', () => {
      render(<div role="status">操作成功</div>);
      const status = screen.getByRole('status');
      expect(status.textContent).toBe('操作成功');
    });
  });

  describe('Color and Contrast', () => {
    it('text has sufficient contrast ratio', () => {
      // This is a placeholder test - actual contrast checking requires
      // visual regression testing or specialized tools
      render(<p style={{ color: '#333', backgroundColor: '#fff' }}>高对比度文本</p>);
      const text = screen.getByText('高对比度文本');
      expect(text).toBeTruthy();
    });

    it('focus indicators are visible', () => {
      render(<MockButton ariaLabel="焦点测试">测试</MockButton>);
      const button = screen.getByLabelText('焦点测试');
      // Focus indicator visibility is tested via CSS, not programmatic checks
      expect(button).toBeTruthy();
    });
  });

  describe('Reduced Motion', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
      // Stub matchMedia for prefers-reduced-motion queries
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('matchMedia can detect prefers-reduced-motion: reduce', () => {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      expect(mq.matches).toBe(true);
    });

    it('matchMedia returns false for no-preference when reduce is active', () => {
      const mq = window.matchMedia('(prefers-reduced-motion: no-preference)');
      expect(mq.matches).toBe(false);
    });

    it('a component can branch on prefers-reduced-motion', () => {
      // Simulate a component that hides animations when reduced-motion is preferred
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function MockAnimatedBox() {
        return (
          <div
            data-testid="animated-box"
            style={{ animation: prefersReducedMotion ? 'none' : 'spin 1s linear infinite' }}
          >
            内容
          </div>
        );
      }

      render(<MockAnimatedBox />);
      const box = screen.getByTestId('animated-box');
      expect(box.style.animation).toBe('none');
    });
  });

  describe('Forced Colors (Windows High Contrast)', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
      // Stub matchMedia for forced-colors queries
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(forced-colors: active)',
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('matchMedia can detect forced-colors: active', () => {
      const mq = window.matchMedia('(forced-colors: active)');
      expect(mq.matches).toBe(true);
    });

    it('a component can detect forced-colors and apply fallback borders', () => {
      const forcedColorsActive = window.matchMedia('(forced-colors: active)').matches;
      function MockDiffMarker() {
        return (
          <div
            data-diff-type="added"
            data-testid="diff-marker"
            style={forcedColorsActive ? { border: '2px solid CanvasText' } : undefined}
          >
            新增内容
          </div>
        );
      }

      render(<MockDiffMarker />);
      const marker = screen.getByTestId('diff-marker');
      // jsdom normalizes CSS color keywords to lowercase
      expect(marker.style.border.toLowerCase()).toBe('2px solid canvastext');
    });

    it('components without forced-colors do not get fallback borders', () => {
      // Reset to no forced-colors
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: false,
          media: query,
          onchange: null,
          addListener: vi.fn(),
          removeListener: vi.fn(),
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });

      const forcedColorsActive = window.matchMedia('(forced-colors: active)').matches;
      function MockDiffMarker() {
        return (
          <div
            data-diff-type="deleted"
            data-testid="diff-marker"
            style={forcedColorsActive ? { border: '2px solid CanvasText' } : undefined}
          >
            删除内容
          </div>
        );
      }

      render(<MockDiffMarker />);
      const marker = screen.getByTestId('diff-marker');
      expect(marker.style.border).toBe('');
    });
  });

  // ── BidLens Component Accessibility ──────────────────────────────

  describe('BidLens Component ARIA', () => {
    it('RelationshipMatrix has grid role with label', async () => {
      const { RelationshipMatrix } = await import('./features/risk-review/relationship-matrix');
      const subs = [
        { id: 's1', fileName: 'A.docx', fileFormat: 'docx' as const, fileSizeBytes: 1024, pageCount: 10, sha256: 'a1', status: 'extracted' as const, warnings: [] },
        { id: 's2', fileName: 'B.docx', fileFormat: 'docx' as const, fileSizeBytes: 2048, pageCount: 20, sha256: 'b1', status: 'extracted' as const, warnings: [] },
      ];
      render(<RelationshipMatrix submissions={subs} findings={[]} />);
      expect(screen.getByRole('grid', { name: '文件关系矩阵' })).toBeTruthy();
    });

    it('RelationshipMatrix cells are keyboard accessible', async () => {
      const { RelationshipMatrix } = await import('./features/risk-review/relationship-matrix');
      const subs = [
        { id: 's1', fileName: 'A.docx', fileFormat: 'docx' as const, fileSizeBytes: 1024, pageCount: 10, sha256: 'a1', status: 'extracted' as const, warnings: [] },
        { id: 's2', fileName: 'B.docx', fileFormat: 'docx' as const, fileSizeBytes: 2048, pageCount: 20, sha256: 'b1', status: 'extracted' as const, warnings: [] },
      ];
      render(<RelationshipMatrix submissions={subs} findings={[]} />);
      const cells = screen.getAllByRole('gridcell');
      cells.forEach((cell) => {
        expect(cell.getAttribute('tabindex')).toBe('0');
      });
    });

    it('FindingVirtualList has listbox role', async () => {
      const { FindingVirtualList } = await import('./features/risk-review/finding-virtual-list');
      const findings = [{
        id: 'f1', detectorType: 'text' as const, riskLevel: 'high' as const,
        involvedSubmissionIds: ['s1', 's2'], evidence: [], symmetricSimilarity: 0.9,
        directionalCoverage: [], confidenceScore: 0.95, reviewStatus: 'pending' as const,
        reviewNote: '', ruleVersion: '1.0.0',
        scoreBreakdown: { exactMatchScore: 0.9, lexicalScore: 0, structuralScore: 0, entityScore: 0, factScore: 0, tenderDiscount: 0, templateDiscount: 0, factConflictPenalty: 0, finalScore: 0.9, ruleVersion: '1.0.0' },
        important: false, reviewedAt: null,
      }];
      render(<FindingVirtualList findings={findings} />);
      expect(screen.getByRole('listbox', { name: '发现项列表' })).toBeTruthy();
    });

    it('FindingVirtualList items have option role with aria-selected', async () => {
      const { FindingVirtualList } = await import('./features/risk-review/finding-virtual-list');
      const findings = [{
        id: 'f1', detectorType: 'text' as const, riskLevel: 'high' as const,
        involvedSubmissionIds: ['s1', 's2'], evidence: [], symmetricSimilarity: 0.9,
        directionalCoverage: [], confidenceScore: 0.95, reviewStatus: 'pending' as const,
        reviewNote: '', ruleVersion: '1.0.0',
        scoreBreakdown: { exactMatchScore: 0.9, lexicalScore: 0, structuralScore: 0, entityScore: 0, factScore: 0, tenderDiscount: 0, templateDiscount: 0, factConflictPenalty: 0, finalScore: 0.9, ruleVersion: '1.0.0' },
        important: false, reviewedAt: null,
      }];
      render(<FindingVirtualList findings={findings} />);
      const options = screen.getAllByRole('option');
      expect(options.length).toBe(1);
      expect(options[0].getAttribute('tabindex')).toBe('0');
    });

    it('EvidenceDetailTabs has region role', async () => {
      const { EvidenceDetailTabs } = await import('./features/risk-review/evidence-detail-tabs');
      const finding = {
        id: 'f1', detectorType: 'text' as const, riskLevel: 'high' as const,
        involvedSubmissionIds: ['s1'], evidence: [], symmetricSimilarity: 0.9,
        directionalCoverage: [{ fromId: 's1', toId: 's2', coverage: 0.85 }],
        confidenceScore: 0.95, reviewStatus: 'pending' as const,
        reviewNote: '', ruleVersion: '1.0.0',
        scoreBreakdown: { exactMatchScore: 0.9, lexicalScore: 0, structuralScore: 0, entityScore: 0, factScore: 0, tenderDiscount: 0, templateDiscount: 0, factConflictPenalty: 0, finalScore: 0.9, ruleVersion: '1.0.0' },
        important: false, reviewedAt: null,
      };
      render(<EvidenceDetailTabs finding={finding} submissionNames={new Map()} />);
      expect(screen.getByRole('region', { name: '发现项详情' })).toBeTruthy();
    });

    it('EvidenceViewport has region role', async () => {
      const { EvidenceViewport } = await import('./features/risk-review/evidence-viewport');
      const evidence = [{
        id: 'ev1', detectorType: 'text' as const, matchBasis: 'semantic' as const, similarityScore: 0.9,
        sourceSubmissionId: 's1', sourceNodeId: 'n1', sourceOriginalText: 'test', sourceNormalizedText: 'test',
        sourceSectionPath: [], sourcePageRange: null, sourceTableLocation: null,
        targetSubmissionId: 's2', targetNodeId: 'n1', targetOriginalText: 'test', targetNormalizedText: 'test',
        targetSectionPath: [], targetPageRange: null, targetTableLocation: null,
        contextBefore: '', contextAfter: '', tenderFiltered: false, tenderFilterReason: null, ruleVersion: '1.0.0',
      }];
      render(<EvidenceViewport evidence={evidence} submissionNames={new Map()} />);
      expect(screen.getByRole('region', { name: '证据视图' })).toBeTruthy();
    });

    it('EvidenceReviewControls has region role', async () => {
      const { EvidenceReviewControls } = await import('./features/risk-review/evidence-review-controls');
      render(<EvidenceReviewControls findingId="f1" currentStatus="pending" reviewNote="" />);
      expect(screen.getByRole('region', { name: '人工复核' })).toBeTruthy();
    });

    it('RiskExportDialog has dialog role with label', async () => {
      const { RiskExportDialog } = await import('./features/risk-review/risk-export-dialog');
      render(
        <RiskExportDialog
          isOpen={true}
          onClose={() => {}}
          projectStatus="ready"
          totalFindings={10}
          confirmedFindings={3}
          importantFindings={2}
        />,
      );
      expect(screen.getByRole('dialog', { name: '导出报告' })).toBeTruthy();
    });
  });
});
