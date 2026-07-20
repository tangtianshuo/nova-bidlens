import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectTable } from './project-table';
import { useProjectStore } from './project-store';
import type { AnalysisProjectSummary } from '../../__fixtures__/risk-project';

afterEach(cleanup);

beforeEach(() => {
  useProjectStore.setState({
    selectedProjectId: null,
    searchText: '',
    statusFilter: null,
    riskFilter: null,
    sortBy: 'createdAt',
    sortOrder: 'desc',
    page: 1,
    pageSize: 10,
  });
});

const FIXTURES: AnalysisProjectSummary[] = [
  {
    id: 'proj-001',
    name: '道路改造工程招标',
    createdAt: '2026-07-20T10:00:00Z',
    status: 'ready',
    submissionCount: 3,
    riskLevel: 'high',
    preset: 'standard',
    hasBaseline: true,
    elapsedMs: 45_000,
  },
  {
    id: 'proj-002',
    name: '桥梁工程招标',
    createdAt: '2026-07-19T09:00:00Z',
    status: 'interrupted',
    submissionCount: 2,
    riskLevel: null,
    preset: 'loose',
    hasBaseline: false,
    elapsedMs: 12_000,
  },
  {
    id: 'proj-003',
    name: '水利工程招标',
    createdAt: '2026-07-18T15:00:00Z',
    status: 'partial',
    submissionCount: 4,
    riskLevel: 'incomplete',
    preset: 'standard',
    hasBaseline: true,
    elapsedMs: 20_000,
  },
];

describe('ProjectTable', () => {
  const defaultProps = {
    projects: FIXTURES,
    onRowClick: vi.fn(),
    onDelete: vi.fn(),
    onResume: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all projects', () => {
    render(<ProjectTable {...defaultProps} />);
    expect(screen.getByText('道路改造工程招标')).toBeTruthy();
    expect(screen.getByText('桥梁工程招标')).toBeTruthy();
    expect(screen.getByText('水利工程招标')).toBeTruthy();
  });

  it('shows empty message when no projects', () => {
    render(<ProjectTable {...defaultProps} projects={[]} />);
    expect(screen.getByText('暂无匹配的项目')).toBeTruthy();
  });

  it('calls onRowClick when row is clicked', async () => {
    const onRowClick = vi.fn();
    render(<ProjectTable {...defaultProps} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText('道路改造工程招标'));
    expect(onRowClick).toHaveBeenCalledWith('proj-001');
  });

  it('displays status badges', () => {
    render(<ProjectTable {...defaultProps} />);
    expect(screen.getByText('已完成')).toBeTruthy();
    expect(screen.getByText('已中断')).toBeTruthy();
    expect(screen.getByText('部分结果')).toBeTruthy();
  });

  it('displays risk badge for projects with risk level', () => {
    render(<ProjectTable {...defaultProps} />);
    expect(screen.getByText('高风险')).toBeTruthy();
  });

  it('displays -- for projects without risk level', () => {
    render(<ProjectTable {...defaultProps} />);
    const dashes = screen.getAllByText('--');
    expect(dashes.length).toBeGreaterThanOrEqual(1);
  });

  it('displays elapsed time formatted as mm:ss', () => {
    render(<ProjectTable {...defaultProps} />);
    expect(screen.getByText('0:45')).toBeTruthy(); // 45000ms = 45s
    expect(screen.getByText('0:12')).toBeTruthy(); // 12000ms = 12s
  });

  it('shows action menu on button click', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ProjectTable {...defaultProps} />);

    const menuButtons = screen.getAllByLabelText('操作');
    await user.click(menuButtons[0]);

    expect(screen.getByText('查看详情')).toBeTruthy();
    expect(screen.getByText('删除')).toBeTruthy();
  });

  it('shows resume option for interrupted projects', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ProjectTable {...defaultProps} />);

    // proj-002 is interrupted — second menu button
    const menuButtons = screen.getAllByLabelText('操作');
    await user.click(menuButtons[1]);

    expect(screen.getByText('恢复分析')).toBeTruthy();
  });

  it('does not show resume option for non-interrupted projects', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ProjectTable {...defaultProps} />);

    // proj-001 is ready — first menu button
    const menuButtons = screen.getAllByLabelText('操作');
    await user.click(menuButtons[0]);

    expect(screen.queryByText('恢复分析')).toBeNull();
  });

  it('calls onDelete when delete menu item clicked', async () => {
    const onDelete = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ProjectTable {...defaultProps} onDelete={onDelete} />);

    const menuButtons = screen.getAllByLabelText('操作');
    await user.click(menuButtons[0]);

    const deleteItem = screen.getByText('删除');
    await user.click(deleteItem);

    expect(onDelete).toHaveBeenCalledWith('proj-001');
  });

  it('calls onResume when resume menu item clicked', async () => {
    const onResume = vi.fn();
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    render(<ProjectTable {...defaultProps} onResume={onResume} />);

    // proj-002 is interrupted
    const menuButtons = screen.getAllByLabelText('操作');
    await user.click(menuButtons[1]);

    const resumeItem = screen.getByText('恢复分析');
    await user.click(resumeItem);

    expect(onResume).toHaveBeenCalledWith('proj-002');
  });

  it('renders sort buttons in sortable column headers', () => {
    render(<ProjectTable {...defaultProps} />);
    expect(screen.getByText('项目名称')).toBeTruthy();
    expect(screen.getByText('状态')).toBeTruthy();
    expect(screen.getByText('风险等级')).toBeTruthy();
    expect(screen.getByText('创建时间')).toBeTruthy();
  });

  it('toggles sort when header clicked', () => {
    render(<ProjectTable {...defaultProps} />);
    fireEvent.click(screen.getByText('项目名称'));
    expect(useProjectStore.getState().sortBy).toBe('name');
    expect(useProjectStore.getState().sortOrder).toBe('asc');
  });
});
