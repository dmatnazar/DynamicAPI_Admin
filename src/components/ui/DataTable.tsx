import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns3,
  GripVertical,
  ChevronLeft,
  ChevronRight,
  X,
} from 'lucide-react';

export interface DataTableColumn<T> {
  id: string;
  header: string;
  /** default true */
  visible?: boolean;
  /** default true */
  sortable?: boolean;
  /** min width px */
  width?: number;
  accessor: (row: T) => unknown;
  cell?: (row: T) => React.ReactNode;
}

interface Props<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  /** storage key for column prefs */
  storageKey?: string;
  searchPlaceholder?: string;
  pageSizeOptions?: number[];
  emptyMessage?: string;
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  onRowClick?: (row: T) => void;
  /** highlight selected row */
  selectedKey?: string | null;
}

type SortDir = 'asc' | 'desc' | null;

function loadPrefs(key?: string) {
  if (!key) return null;
  try {
    return JSON.parse(localStorage.getItem(`dt:${key}`) || 'null');
  } catch {
    return null;
  }
}

function savePrefs(key: string | undefined, data: unknown) {
  if (!key) return;
  try {
    localStorage.setItem(`dt:${key}`, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function DataTable<T>({
  columns: columnsProp,
  rows,
  rowKey,
  storageKey,
  searchPlaceholder = 'Gözle...',
  pageSizeOptions = [10, 25, 50, 100],
  emptyMessage = 'Maglumat ýok',
  toolbarLeft,
  toolbarRight,
  onRowClick,
  selectedKey,
}: Props<T>) {
  const prefs = loadPrefs(storageKey);
  const [search, setSearch] = useState('');
  const [sortId, setSortId] = useState<string | null>(() => prefs?.sortId ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(() => prefs?.sortDir ?? null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => prefs?.pageSize ?? pageSizeOptions[0] ?? 25);
  const [colOrder, setColOrder] = useState<string[]>(() => {
    const ids = columnsProp.map((c) => c.id);
    const saved: string[] = Array.isArray(prefs?.colOrder) ? prefs.colOrder : [];
    const kept = saved.filter((id: string) => ids.includes(id));
    const missing = ids.filter((id) => !kept.includes(id));
    return kept.length ? [...kept, ...missing] : ids;
  });
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const base: Record<string, boolean> = {};
    for (const c of columnsProp) base[c.id] = c.visible !== false;
    const saved = (prefs?.visibility && typeof prefs.visibility === 'object') ? prefs.visibility : {};
    return { ...base, ...saved };
  });
  const [colsOpen, setColsOpen] = useState(false);
  const dragCol = useRef<string | null>(null);
  const prefsReady = useRef(false);

  // persist prefs (skip first paint to avoid overwriting with defaults before merge)
  useEffect(() => {
    if (!prefsReady.current) {
      prefsReady.current = true;
      // still save merged state once so key exists
      savePrefs(storageKey, { sortId, sortDir, pageSize, colOrder, visibility });
      return;
    }
    savePrefs(storageKey, { sortId, sortDir, pageSize, colOrder, visibility });
  }, [storageKey, sortId, sortDir, pageSize, colOrder, visibility]);

  // keep order / visibility in sync if new columns appear (never reset user choices)
  useEffect(() => {
    const ids = columnsProp.map((c) => c.id);
    setColOrder((prev) => {
      const kept = prev.filter((id) => ids.includes(id));
      const missing = ids.filter((id) => !kept.includes(id));
      return [...kept, ...missing];
    });
    setVisibility((prev) => {
      const next = { ...prev };
      for (const c of columnsProp) {
        if (next[c.id] === undefined) next[c.id] = c.visible !== false;
      }
      return next;
    });
  }, [columnsProp.map((c) => c.id).join('|')]);

  const orderedCols = useMemo(() => {
    const map = new Map(columnsProp.map((c) => [c.id, c]));
    return colOrder.map((id) => map.get(id)).filter(Boolean) as DataTableColumn<T>[];
  }, [columnsProp, colOrder]);

  const visibleCols = orderedCols.filter((c) => visibility[c.id] !== false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      orderedCols.some((c) => {
        const v = c.accessor(row);
        return v != null && String(v).toLowerCase().includes(q);
      })
    );
  }, [rows, search, orderedCols]);

  const sorted = useMemo(() => {
    if (!sortId || !sortDir) return filtered;
    const col = orderedCols.find((c) => c.id === sortId);
    if (!col) return filtered;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.accessor(a);
      const bv = col.accessor(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
      return String(av).localeCompare(String(bv), undefined, { sensitivity: 'base' }) * dir;
    });
  }, [filtered, sortId, sortDir, orderedCols]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const toggleSort = (id: string) => {
    const col = orderedCols.find((c) => c.id === id);
    if (col?.sortable === false) return;
    if (sortId !== id) {
      setSortId(id);
      setSortDir('asc');
    } else if (sortDir === 'asc') setSortDir('desc');
    else if (sortDir === 'desc') {
      setSortId(null);
      setSortDir(null);
    } else setSortDir('asc');
  };

  const onDragStart = (id: string) => {
    dragCol.current = id;
  };
  const onDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    const from = dragCol.current;
    if (!from || from === overId) return;
    setColOrder((prev) => {
      const next = [...prev];
      const fi = next.indexOf(from);
      const ti = next.indexOf(overId);
      if (fi < 0 || ti < 0) return prev;
      next.splice(fi, 1);
      next.splice(ti, 0, from);
      return next;
    });
    dragCol.current = overId;
  };

  const SortIcon = ({ id }: { id: string }) => {
    if (sortId !== id) return <ArrowUpDown size={12} className="opacity-40" />;
    if (sortDir === 'asc') return <ArrowUp size={12} className="text-indigo-400" />;
    return <ArrowDown size={12} className="text-indigo-400" />;
  };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {toolbarLeft}
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-8 pr-8 rounded-lg bg-surface-raised border border-surface-border text-sm text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-indigo-500/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {toolbarRight}
          <div className="relative">
            <button
              type="button"
              onClick={() => setColsOpen((v) => !v)}
              className="h-9 px-3 rounded-lg border border-surface-border bg-surface-raised text-xs text-neutral-300 hover:text-white inline-flex items-center gap-1.5"
            >
              <Columns3 size={14} />
              Sütünler
            </button>
            {colsOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setColsOpen(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-56 rounded-xl border border-surface-border bg-surface-raised shadow-xl p-2 space-y-0.5">
                  <p className="text-[10px] uppercase tracking-wide text-neutral-500 px-2 py-1">
                    Görkez / gizle · süýşürip tertiple
                  </p>
                  {orderedCols.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={() => onDragStart(c.id)}
                      onDragOver={(e) => onDragOver(e, c.id)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-surface-card cursor-grab active:cursor-grabbing text-sm"
                    >
                      <GripVertical size={12} className="text-neutral-600 shrink-0" />
                      <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
                        <input
                          type="checkbox"
                          checked={visibility[c.id] !== false}
                          onChange={(e) =>
                            setVisibility((v) => ({ ...v, [c.id]: e.target.checked }))
                          }
                        />
                        <span className="truncate text-neutral-200">{c.header}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-surface-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-surface-raised border-b border-surface-border">
              {visibleCols.map((c) => (
                <th
                  key={c.id}
                  draggable
                  onDragStart={() => onDragStart(c.id)}
                  onDragOver={(e) => onDragOver(e, c.id)}
                  style={c.width ? { minWidth: c.width } : undefined}
                  className="px-3 py-2.5 text-left text-xs font-medium text-neutral-400 whitespace-nowrap select-none"
                >
                  <button
                    type="button"
                    onClick={() => toggleSort(c.id)}
                    className="inline-flex items-center gap-1.5 hover:text-neutral-200"
                    disabled={c.sortable === false}
                  >
                    <GripVertical size={11} className="text-neutral-600 cursor-grab" />
                    {c.header}
                    {c.sortable !== false && <SortIcon id={c.id} />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(visibleCols.length, 1)}
                  className="px-4 py-12 text-center text-neutral-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const key = rowKey(row);
                const selected = selectedKey === key;
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row)}
                    className={`border-b border-surface-border/50 transition ${
                      onRowClick ? 'cursor-pointer' : ''
                    } ${selected ? 'bg-indigo-500/10' : 'hover:bg-surface-card/40'}`}
                  >
                    {visibleCols.map((c) => (
                      <td key={c.id} className="px-3 py-2.5 text-neutral-200 align-middle">
                        {c.cell ? c.cell(row) : String(c.accessor(row) ?? '—')}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-neutral-500">
        <div className="flex items-center gap-2">
          <span>
            {sorted.length} hat · {safePage * pageSize + 1}–
            {Math.min((safePage + 1) * pageSize, sorted.length)}
          </span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setPage(0);
            }}
            className="h-8 rounded-md bg-surface-raised border border-surface-border px-2 text-neutral-300"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n} / sahypa
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={safePage <= 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-surface-border disabled:opacity-40 hover:bg-surface-card"
          >
            <ChevronLeft size={14} />
          </button>
          <span className="px-2 text-neutral-400">
            {safePage + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            className="h-8 w-8 inline-flex items-center justify-center rounded-md border border-surface-border disabled:opacity-40 hover:bg-surface-card"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
