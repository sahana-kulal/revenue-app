import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App, { mergeProducts } from './App';
import { formatNumber } from './utils';

// ─── unit: mergeProducts ────────────────────────────────────────────────────

describe('mergeProducts', () => {
  it('merges products from multiple branches and sums revenue', () => {
    const data = [
      [{ name: 'Apple', revenue: 100 }, { name: 'Banana', revenue: 200 }],
      [{ name: 'Apple', revenue: 50 }, { name: 'Cherry', revenue: 300 }],
    ];
    const result = mergeProducts(data);
    const apple = result.find(p => p.name === 'Apple');
    expect(apple.revenue).toBe(150);
  });

  it('sorts products alphabetically by name', () => {
    const data = [
      [{ name: 'Cherry', revenue: 10 }, { name: 'Apple', revenue: 20 }, { name: 'Banana', revenue: 30 }],
    ];
    const result = mergeProducts(data);
    expect(result.map(p => p.name)).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  it('returns each unique product once', () => {
    const data = [
      [{ name: 'Kiwi', revenue: 100 }],
      [{ name: 'Kiwi', revenue: 200 }],
    ];
    const result = mergeProducts(data);
    expect(result.filter(p => p.name === 'Kiwi').length).toBe(1);
  });
});

// ─── unit: formatNumber ────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('formats integers with two decimal places', () => {
    expect(formatNumber(1000)).toBe('1,000.00');
  });

  it('formats decimal numbers correctly', () => {
    expect(formatNumber(1234.5)).toBe('1,234.50');
  });

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0.00');
  });
});

// ─── integration: App component ───────────────────────────────────────────

const branch1 = [
  { name: 'Apple', revenue: 1200.50 },
  { name: 'Banana', revenue: 450.00 },
  { name: 'Cherry', revenue: 870.25 },
];
const branch2 = [
  { name: 'Apple', revenue: 930.00 },
  { name: 'Date', revenue: 640.50 },
  { name: 'Cherry', revenue: 415.00 },
];
const branch3 = [
  { name: 'Banana', revenue: 310.75 },
  { name: 'Elderberry', revenue: 520.00 },
];

beforeEach(() => {
  global.fetch = jest.fn(url => {
    let data;
    if (url.includes('branch1')) data = branch1;
    else if (url.includes('branch2')) data = branch2;
    else data = branch3;
    return Promise.resolve({ json: () => Promise.resolve(data) });
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('App', () => {
  it('renders the heading', () => {
    render(<App />);
    expect(screen.getByText(/Revenue Dashboard/i)).toBeInTheDocument();
  });

  it('shows a Search label and text input inline', () => {
    render(<App />);
    expect(screen.getByLabelText(/Search/i)).toBeInTheDocument();
  });

  it('shows a loading indicator initially', () => {
    render(<App />);
    expect(screen.getByText(/Loading/i)).toBeInTheDocument();
  });

  it('renders product rows after data loads', async () => {
    render(<App />);
    await waitFor(() => expect(screen.getByText('Apple')).toBeInTheDocument());
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('Cherry')).toBeInTheDocument();
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Elderberry')).toBeInTheDocument();
  });

  it('products are sorted alphabetically', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Apple'));
    const rows = screen.getAllByRole('row');
    // rows[0] = thead tr, rows[1..] = body rows, last = tfoot total
    const names = rows.slice(1, rows.length - 1).map(r => r.cells[0].textContent);
    expect(names).toEqual([...names].sort());
  });

  it('merges same-product revenue across branches', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Apple'));
    // Apple: 1200.50 + 930.00 = 2130.50 → "$2,130.50"
    expect(screen.getByText('$2,130.50')).toBeInTheDocument();
    // Banana: 450.00 + 310.75 = 760.75 → "$760.75"
    expect(screen.getByText('$760.75')).toBeInTheDocument();
  });

  it('filters products by name (case insensitive)', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Apple'));
    fireEvent.change(screen.getByLabelText(/Search/i), { target: { value: 'an' } });
    // 'Banana' contains 'an', others don't
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.queryByText('Apple')).not.toBeInTheDocument();
    expect(screen.queryByText('Cherry')).not.toBeInTheDocument();
  });

  it('filter is case insensitive', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Apple'));
    fireEvent.change(screen.getByLabelText(/Search/i), { target: { value: 'APPLE' } });
    expect(screen.getByText('Apple')).toBeInTheDocument();
    expect(screen.queryByText('Banana')).not.toBeInTheDocument();
  });

  it('total revenue updates when filter is applied', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Apple'));

    // Unfiltered total: Apple(2130.50) + Banana(760.75) + Cherry(1285.25) + Date(640.50) + Elderberry(520.00) = 5337.00
    const totalRow = screen.getAllByRole('row').at(-1);
    expect(totalRow.cells[0].textContent).toBe('Total');
    const unfiltered = totalRow.cells[1].textContent;
    expect(unfiltered).toBe('$5,337.00');

    // Filter to only 'Apple' (revenue 2130.50)
    fireEvent.change(screen.getByLabelText(/Search/i), { target: { value: 'apple' } });
    const filteredTotal = screen.getAllByRole('row').at(-1).cells[1].textContent;
    expect(filteredTotal).toBe('$2,130.50');
  });

  it('shows no-results message when nothing matches', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Apple'));
    fireEvent.change(screen.getByLabelText(/Search/i), { target: { value: 'zzz' } });
    expect(screen.getByText(/No products match/i)).toBeInTheDocument();
  });

  it('total shows $0.00 when no products match filter', async () => {
    render(<App />);
    await waitFor(() => screen.getByText('Apple'));
    fireEvent.change(screen.getByLabelText(/Search/i), { target: { value: 'zzz' } });
    const totalRow = screen.getAllByRole('row').at(-1);
    expect(totalRow.cells[1].textContent).toBe('$0.00');
  });
});
