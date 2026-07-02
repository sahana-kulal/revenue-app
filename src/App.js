import React, { useState, useEffect, useMemo } from 'react';
import { formatNumber } from './utils';
import './App.css';

const BRANCH_URLS = ['api/branch1.json', 'api/branch2.json', 'api/branch3.json'];

export function mergeProducts(allBranchData) {
  const map = new Map();
  for (const products of allBranchData) {
    for (const { name, revenue } of products) {
      map.set(name, (map.get(name) || 0) + revenue);
    }
  }
  return Array.from(map.entries())
    .map(([name, revenue]) => ({ name, revenue }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    Promise.all(BRANCH_URLS.map(url => fetch(url).then(r => r.json())))
      .then(allData => {
        setProducts(mergeProducts(allData));
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  const filtered = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (!term) return products;
    return products.filter(p => p.name.toLowerCase().includes(term));
  }, [products, filter]);

  const totalRevenue = useMemo(
    () => filtered.reduce((sum, p) => sum + p.revenue, 0),
    [filtered]
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Revenue Dashboard</h1>
        <p className="subtitle">Multi-branch product revenue overview</p>
      </header>

      <main className="app-main">
        <div className="search-bar">
          <label htmlFor="filter">Search:</label>
          <input
            id="filter"
            type="text"
            placeholder="Filter by product name…"
            value={filter}
            onChange={e => setFilter(e.target.value)}
          />
        </div>

        {loading && <div className="status">Loading branch data…</div>}
        {error && <div className="status error">Error: {error}</div>}

        {!loading && !error && (
          <div className="table-wrapper">
            <table className="revenue-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th className="num-col">Total Revenue</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="2" className="no-results">No products match your search.</td>
                  </tr>
                ) : (
                  filtered.map(({ name, revenue }) => (
                    <tr key={name}>
                      <td>{name}</td>
                      <td className="num-col">${formatNumber(revenue)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td>Total</td>
                  <td className="num-col">${formatNumber(totalRevenue)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
