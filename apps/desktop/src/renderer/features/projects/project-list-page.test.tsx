import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ProjectListPage } from './project-list-page';
import { useProjectStore } from './project-store';

afterEach(cleanup);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

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

async function renderPage() {
  const wrapper = createWrapper();
  const result = render(<ProjectListPage />, { wrapper });
  await waitFor(() => {
    expect(screen.queryByText('项目列表')).toBeTruthy();
  });
  return result;
}

describe('ProjectListPage', () => {
  it('renders page title', async () => {
    await renderPage();
    expect(screen.getByText('项目列表')).toBeTruthy();
  });

  it('shows loading skeleton initially', () => {
    const wrapper = createWrapper();
    const { container } = render(<ProjectListPage />, { wrapper });
    expect(container.querySelector('.animate-pulse')).toBeTruthy();
  });

  it('displays projects after loading', async () => {
    await renderPage();
    expect(screen.getByText(/XX道路改造工程招标项目/)).toBeTruthy();
    // "已中断" appears in both project name and status badge
    expect(screen.getAllByText(/已中断/).length).toBeGreaterThanOrEqual(2);
  });

  it('renders search input', async () => {
    await renderPage();
    expect(screen.getByPlaceholderText('搜索项目名称...')).toBeTruthy();
  });

  it('renders filter selects', async () => {
    await renderPage();
    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.length).toBe(3); // status, risk, sort
  });

  describe('search', () => {
    it('filters projects by name', async () => {
      await renderPage();
      const input = screen.getByPlaceholderText('搜索项目名称...');
      fireEvent.change(input, { target: { value: '无基线' } });

      expect(screen.getByText(/无基线/)).toBeTruthy();
      expect(screen.queryByText(/已中断/)).toBeNull();
    });

    it('shows filtered count', async () => {
      await renderPage();
      const input = screen.getByPlaceholderText('搜索项目名称...');
      fireEvent.change(input, { target: { value: '无基线' } });
      expect(screen.getByText(/显示 1 \/ 6 个项目/)).toBeTruthy();
    });

    it('clears search on X button click', async () => {
      await renderPage();
      const input = screen.getByPlaceholderText('搜索项目名称...');
      fireEvent.change(input, { target: { value: 'test' } });

      const clearBtn = screen.getByLabelText('清除搜索');
      fireEvent.click(clearBtn);

      expect(useProjectStore.getState().searchText).toBe('');
    });

    it('resets page to 1 when search changes', async () => {
      useProjectStore.setState({ page: 3 });
      await renderPage();
      const input = screen.getByPlaceholderText('搜索项目名称...');
      fireEvent.change(input, { target: { value: 'test' } });
      expect(useProjectStore.getState().page).toBe(1);
    });
  });

  describe('status filter', () => {
    it('updates store when status filter changes', async () => {
      await renderPage();
      // Verify store interaction directly
      useProjectStore.getState().setStatusFilter('interrupted');
      expect(useProjectStore.getState().statusFilter).toBe('interrupted');
    });

    it('filters displayed projects by status', async () => {
      await renderPage();
      useProjectStore.getState().setStatusFilter('interrupted');
      // Only the interrupted project should remain visible
      await waitFor(() => {
        expect(screen.queryByText(/XX道路改造工程招标项目/)).toBeNull();
        expect(screen.getByText(/XX道路改造工程（已中断）/)).toBeTruthy();
      });
    });
  });

  describe('risk filter', () => {
    it('updates store when risk filter changes', async () => {
      await renderPage();
      useProjectStore.getState().setRiskFilter('high');
      expect(useProjectStore.getState().riskFilter).toBe('high');
    });
  });

  describe('sort', () => {
    it('sorts by default (createdAt desc)', async () => {
      await renderPage();
      const rows = screen.getAllByRole('row');
      // proj-fixture-006 has the latest createdAt
      expect(rows[1].textContent).toContain('处理中');
    });

    it('changes sort field updates store', async () => {
      await renderPage();
      useProjectStore.getState().setSort('name');
      expect(useProjectStore.getState().sortBy).toBe('name');
    });
  });

  describe('pagination', () => {
    it('does not show pagination when items fit in one page', async () => {
      await renderPage();
      expect(screen.queryByRole('navigation', { name: /pagination/ })).toBeNull();
    });

    it('shows pagination when items exceed page size', async () => {
      useProjectStore.setState({ pageSize: 3 });
      await renderPage();
      expect(screen.getByRole('navigation', { name: /pagination/ })).toBeTruthy();
    });

    it('paginates data correctly', async () => {
      useProjectStore.setState({ pageSize: 3, page: 1 });
      await renderPage();
      // Page 1: first 3 items. Page 2: remaining 2.
      // With 5 fixtures and pageSize=3, page 1 shows 3 rows
      const table = screen.getByRole('table');
      const dataRows = table.querySelectorAll('tbody tr');
      expect(dataRows.length).toBe(3);
    });

    it('navigates to next page', async () => {
      useProjectStore.setState({ pageSize: 3 });
      await renderPage();

      const nextLink = screen.getByLabelText('Go to next page');
      fireEvent.click(nextLink);

      expect(useProjectStore.getState().page).toBe(2);
    });

    it('disables previous on first page', async () => {
      useProjectStore.setState({ pageSize: 3, page: 1 });
      await renderPage();

      const prevLink = screen.getByLabelText('Go to previous page');
      expect(prevLink.classList.contains('pointer-events-none')).toBe(true);
    });
  });

  describe('row click', () => {
    it('logs navigation on row click', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      await renderPage();

      fireEvent.click(screen.getByText(/XX道路改造工程招标项目/));

      expect(consoleSpy).toHaveBeenCalledWith('[ProjectList] navigate to project:', 'proj-fixture-001');
      consoleSpy.mockRestore();
    });
  });

  describe('clear filters', () => {
    it('shows clear filters button when filters active', async () => {
      await renderPage();
      expect(screen.queryByText('清除筛选')).toBeNull();

      fireEvent.change(screen.getByPlaceholderText('搜索项目名称...'), { target: { value: 'test' } });
      expect(screen.getByText('清除筛选')).toBeTruthy();
    });

    it('clears all filters on clear button click', async () => {
      await renderPage();
      fireEvent.change(screen.getByPlaceholderText('搜索项目名称...'), { target: { value: 'test' } });

      fireEvent.click(screen.getByText('清除筛选'));

      expect(useProjectStore.getState().searchText).toBe('');
      expect(useProjectStore.getState().statusFilter).toBeNull();
      expect(useProjectStore.getState().riskFilter).toBeNull();
    });
  });

  it('shows total project count without filters', async () => {
    await renderPage();
    expect(screen.getByText('共 6 个项目')).toBeTruthy();
  });
});
