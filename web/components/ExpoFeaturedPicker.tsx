'use client';

import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react';

export interface FeaturedBusinessOption {
  id: string;
  name: string;
  business_kind: 'vendor' | 'partner';
  status: string;
  gift_count: number;
}

interface Props {
  options: FeaturedBusinessOption[];
  initialIds: string[];
}

/** Ordered manual selection for the home featured shelf. */
export function ExpoFeaturedPicker({ options, initialIds }: Props) {
  const [ids, setIds] = useState(() =>
    initialIds.filter((id) => options.some((option) => option.id === id)),
  );
  const [query, setQuery] = useState('');

  const byId = useMemo(() => new Map(options.map((option) => [option.id, option])), [options]);
  const selected = ids.map((id) => byId.get(id)).filter((option): option is FeaturedBusinessOption => Boolean(option));
  const available = useMemo(() => {
    const term = query.trim().toLowerCase();
    return options
      .filter((option) => !ids.includes(option.id))
      .filter((option) => !term || option.name.toLowerCase().includes(term))
      .slice(0, 25);
  }, [options, ids, query]);

  function move(id: string, direction: -1 | 1) {
    setIds((current) => {
      const index = current.indexOf(id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= current.length) return current;
      const copy = [...current];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  }

  function remove(id: string) {
    setIds((current) => current.filter((value) => value !== id));
  }

  return (
    <>
      <input type="hidden" name="business_ids" value={JSON.stringify(ids)} />

      <div className="panel-head">
        <h4>Selected businesses</h4>
        <span className="small muted">{selected.length} in order</span>
      </div>
      <div className="split-list">
        {selected.length === 0 ? (
          <span className="muted">No businesses selected yet. The shelf falls back to the automatic ranking.</span>
        ) : (
          selected.map((option, index) => (
            <div key={option.id} className="split-row">
              <span className="k">
                {index + 1}. {option.name}{' '}
                <span className="muted">({option.business_kind})</span>
              </span>
              <span className="v" style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => move(option.id, -1)}
                  aria-label={`Move ${option.name} up`}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => move(option.id, 1)}
                  aria-label={`Move ${option.name} down`}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => remove(option.id)}
                  aria-label={`Remove ${option.name}`}
                >
                  <X size={14} />
                </button>
              </span>
            </div>
          ))
        )}
      </div>

      <div className="field" style={{ marginTop: 12 }}>
        <label htmlFor="expo-featured-search">Add a business</label>
        <input
          id="expo-featured-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search approved vendors and active partners"
        />
        <span className="hint">Order is preserved. Only visible businesses can be picked.</span>
      </div>

      <div className="table-wrap">
        <table className="data">
          <thead>
            <tr>
              <th>Business</th>
              <th>Type</th>
              <th>Gift cards</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {available.map((option) => (
              <tr key={option.id}>
                <td>{option.name}</td>
                <td>{option.business_kind}</td>
                <td>{option.gift_count}</td>
                <td>
                  <button
                    type="button"
                    className="btn sm ghost"
                    onClick={() => setIds((current) => [...current, option.id])}
                  >
                    <Plus size={14} /> Add
                  </button>
                </td>
              </tr>
            ))}
            {available.length === 0 ? (
              <tr>
                <td colSpan={4} className="muted">No matching businesses.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
