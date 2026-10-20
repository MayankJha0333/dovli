import { useEffect, useMemo, useRef, useState } from "react";
import { createReactBlockSpec } from "@blocknote/react";
import { nanoid } from "nanoid";
import { cn, Icon, MenuCheckboxItem, MenuContent, MenuItem, MenuLabel, MenuRoot, MenuSeparator, MenuTrigger, type IconName } from "@dovli/ui";
import { debounce, stopEditorKeys } from "./shared";

// A simple table with typed columns (text, number, date, tick box) that sorts by any column.
// The default "Table" block stays available for free-form grids; this one is for lists of things.

export type ColumnType = "text" | "number" | "date" | "checkbox";

export interface TableData {
  columns: { id: string; name: string; type: ColumnType }[];
  rows: { id: string; cells: Record<string, string | number | boolean | null> }[];
  sort: { col: string; dir: "asc" | "desc" } | null;
}

const TYPE_INFO: Record<ColumnType, { label: string; icon: IconName }> = {
  text: { label: "Text", icon: "outline" },
  number: { label: "Number", icon: "hash" },
  date: { label: "Date", icon: "clock" },
  checkbox: { label: "Tick box", icon: "check" },
};

export function newTable(): TableData {
  const a = nanoid(6);
  const b = nanoid(6);
  const c = nanoid(6);
  return {
    columns: [
      { id: a, name: "Name", type: "text" },
      { id: b, name: "Done", type: "checkbox" },
      { id: c, name: "Due", type: "date" },
    ],
    rows: [
      { id: nanoid(6), cells: { [a]: "", [b]: false, [c]: "" } },
      { id: nanoid(6), cells: { [a]: "", [b]: false, [c]: "" } },
    ],
    sort: null,
  };
}

export function parseTable(raw: string): TableData {
  try {
    const d = JSON.parse(raw);
    if (Array.isArray(d.columns) && Array.isArray(d.rows)) return { sort: null, ...d };
  } catch {
    /* fall through */
  }
  return newTable();
}

function compare(type: ColumnType, a: unknown, b: unknown): number {
  const empty = (v: unknown) => v === "" || v === null || v === undefined;
  if (empty(a) && empty(b)) return 0;
  if (empty(a)) return 1; // blanks last
  if (empty(b)) return -1;
  if (type === "number") return Number(a) - Number(b);
  if (type === "checkbox") return Number(!!b) - Number(!!a);
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

export function sortedRows(t: TableData) {
  if (!t.sort) return t.rows;
  const col = t.columns.find((c) => c.id === t.sort!.col);
  if (!col) return t.rows;
  const dir = t.sort.dir === "asc" ? 1 : -1;
  return [...t.rows].sort((x, y) => dir * compare(col.type, x.cells[col.id], y.cells[col.id]));
}

const cellInput =
  "h-9 w-full min-w-0 border-0 bg-transparent px-2.5 text-base text-ink outline-none focus:bg-accent-soft disabled:cursor-default";

function Cell({
  type,
  value,
  onChange,
  editable,
  label,
}: {
  type: ColumnType;
  value: unknown;
  onChange: (v: string | number | boolean | null) => void;
  editable: boolean;
  label: string;
}) {
  if (type === "checkbox")
    return (
      <span className="flex h-9 items-center px-2.5">
        <input
          type="checkbox"
          aria-label={label}
          checked={!!value}
          disabled={!editable}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4 accent-[var(--d-accent)]"
        />
      </span>
    );
  return (
    <input
      aria-label={label}
      type={type === "number" ? "text" : type === "date" ? "date" : "text"}
      inputMode={type === "number" ? "decimal" : undefined}
      value={value === null || value === undefined ? "" : String(value)}
      disabled={!editable}
      onKeyDown={stopEditorKeys}
      onChange={(e) => {
        const v = e.target.value;
        if (type === "number") {
          const cleaned = v.replace(/[^\d.,-]/g, "").replace(",", ".");
          onChange(cleaned === "" ? "" : cleaned);
        } else onChange(v);
      }}
      className={cn(cellInput, type === "number" && "text-right tabular-nums")}
    />
  );
}

function DataTableView({ block, editor }: { block: any; editor: any }) {
  const raw: string = block.props.data;
  const [table, setTable] = useState<TableData>(() => parseTable(raw));
  const lastWritten = useRef(raw);
  const editable = editor.isEditable;

  // Undo/redo or a sync from another device changed the block: follow it.
  useEffect(() => {
    if (raw !== lastWritten.current) {
      lastWritten.current = raw;
      setTable(parseTable(raw));
    }
  }, [raw]);

  const write = useMemo(
    () =>
      debounce((t: TableData) => {
        const json = JSON.stringify(t);
        lastWritten.current = json;
        if (editor.getBlock(block.id)) editor.updateBlock(block.id, { props: { data: json } });
      }, 350),
    [editor, block.id],
  );

  const update = (fn: (t: TableData) => TableData) => {
    setTable((t) => {
      const next = fn(t);
      write(next);
      return next;
    });
  };

  const setCell = (rowId: string, colId: string, v: string | number | boolean | null) =>
    update((t) => ({ ...t, rows: t.rows.map((r) => (r.id === rowId ? { ...r, cells: { ...r.cells, [colId]: v } } : r)) }));
  const addRow = () =>
    update((t) => ({ ...t, rows: [...t.rows, { id: nanoid(6), cells: Object.fromEntries(t.columns.map((c) => [c.id, c.type === "checkbox" ? false : ""])) }] }));
  const addColumn = () => update((t) => ({ ...t, columns: [...t.columns, { id: nanoid(6), name: `Column ${t.columns.length + 1}`, type: "text" }] }));
  const removeRow = (id: string) => update((t) => ({ ...t, rows: t.rows.filter((r) => r.id !== id) }));
  const removeColumn = (id: string) =>
    update((t) => ({
      ...t,
      columns: t.columns.filter((c) => c.id !== id),
      sort: t.sort?.col === id ? null : t.sort,
      rows: t.rows.map((r) => {
        const { [id]: _gone, ...cells } = r.cells;
        return { ...r, cells };
      }),
    }));
  const renameColumn = (id: string, name: string) => update((t) => ({ ...t, columns: t.columns.map((c) => (c.id === id ? { ...c, name } : c)) }));
  const setType = (id: string, type: ColumnType) =>
    update((t) => ({
      ...t,
      columns: t.columns.map((c) => (c.id === id ? { ...c, type } : c)),
      rows: t.rows.map((r) => ({ ...r, cells: { ...r.cells, [id]: type === "checkbox" ? !!r.cells[id] : r.cells[id] === true ? "yes" : r.cells[id] === false ? "" : r.cells[id] } })),
    }));
  const setSort = (col: string, dir: "asc" | "desc" | null) => update((t) => ({ ...t, sort: dir ? { col, dir } : null }));

  const rows = sortedRows(table);

  return (
    <div className="my-1.5 w-full overflow-x-auto rounded-md font-sans shadow-[inset_0_0_0_1px_var(--d-line)]" contentEditable={false}>
      <table className="w-full min-w-[420px] border-collapse text-left">
        <thead>
          <tr className="bg-well">
            {table.columns.map((c) => {
              const sorted = table.sort?.col === c.id ? table.sort.dir : null;
              return (
                <th key={c.id} scope="col" className="border-b border-r border-line p-0 font-medium last:border-r-0" aria-sort={sorted === "asc" ? "ascending" : sorted === "desc" ? "descending" : undefined}>
                  <div className="flex h-9 items-center gap-1 pl-1.5 pr-1">
                    <MenuRoot>
                      <MenuTrigger asChild disabled={!editable}>
                        <button type="button" className="grid size-6 flex-none place-items-center rounded-xs text-ink-3 hover:bg-hover hover:text-ink" aria-label={`${c.name} column options`}>
                          <Icon name={TYPE_INFO[c.type].icon} size={13} />
                        </button>
                      </MenuTrigger>
                      <MenuContent align="start">
                        <MenuLabel>Column type</MenuLabel>
                        {(Object.keys(TYPE_INFO) as ColumnType[]).map((t) => (
                          <MenuCheckboxItem key={t} checked={c.type === t} onCheckedChange={() => setType(c.id, t)}>
                            {TYPE_INFO[t].label}
                          </MenuCheckboxItem>
                        ))}
                        <MenuSeparator />
                        <MenuItem icon="arrowUp" onSelect={() => setSort(c.id, "asc")}>
                          Sort ascending
                        </MenuItem>
                        <MenuItem icon="arrowDown" onSelect={() => setSort(c.id, "desc")}>
                          Sort descending
                        </MenuItem>
                        {table.sort && (
                          <MenuItem icon="close" onSelect={() => setSort(c.id, null)}>
                            Stop sorting
                          </MenuItem>
                        )}
                        <MenuSeparator />
                        <MenuItem icon="trash" danger disabled={table.columns.length <= 1} onSelect={() => removeColumn(c.id)}>
                          Delete column
                        </MenuItem>
                      </MenuContent>
                    </MenuRoot>
                    <input
                      aria-label="Column name"
                      value={c.name}
                      disabled={!editable}
                      onKeyDown={stopEditorKeys}
                      onChange={(e) => renameColumn(c.id, e.target.value)}
                      className="h-7 min-w-0 flex-1 rounded-xs border-0 bg-transparent px-1 text-sm font-semibold text-ink-2 outline-none focus:bg-panel"
                    />
                    <button
                      type="button"
                      onClick={() => setSort(c.id, sorted === "asc" ? "desc" : sorted === "desc" ? null : "asc")}
                      className={cn("grid size-6 flex-none place-items-center rounded-xs hover:bg-hover", sorted ? "text-accent" : "text-ink-4")}
                      aria-label={`Sort by ${c.name}`}
                      title="Sort"
                    >
                      <Icon name={sorted === "desc" ? "arrowDown" : "arrowUp"} size={12} />
                    </button>
                  </div>
                </th>
              );
            })}
            {editable && (
              <th className="w-9 border-b border-line p-0" data-print="hide">
                <button type="button" onClick={addColumn} className="grid h-9 w-9 place-items-center text-ink-3 hover:bg-hover hover:text-ink" aria-label="Add column" title="Add column">
                  <Icon name="plus" size={14} />
                </button>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id} className="group/row">
              {table.columns.map((c) => (
                <td key={c.id} className="border-b border-r border-line p-0 last:border-r-0">
                  <Cell type={c.type} value={r.cells[c.id]} editable={editable} label={`${c.name}, row ${i + 1}`} onChange={(v) => setCell(r.id, c.id, v)} />
                </td>
              ))}
              {editable && (
                <td className="w-9 border-b border-line p-0" data-print="hide">
                  <button
                    type="button"
                    onClick={() => removeRow(r.id)}
                    className="grid h-9 w-9 place-items-center text-ink-4 opacity-0 hover:text-danger focus-visible:opacity-100 group-hover/row:opacity-100"
                    aria-label={`Delete row ${i + 1}`}
                  >
                    <Icon name="trash" size={13} />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {editable && (
        <button type="button" onClick={addRow} data-print="hide" className="flex h-9 w-full items-center gap-2 px-3 text-sm text-ink-3 hover:bg-hover hover:text-ink">
          <Icon name="plus" size={13} />
          New row
        </button>
      )}
    </div>
  );
}

export const dataTableBlock = createReactBlockSpec(
  { type: "dataTable", propSchema: { data: { default: "" } }, content: "none" },
  {
    render: ({ block, editor }) => <DataTableView block={block} editor={editor} />,
    toExternalHTML: ({ block }) => {
      const t = parseTable(block.props.data);
      const show = (type: ColumnType, v: unknown) => (type === "checkbox" ? (v ? "✓" : "") : String(v ?? ""));
      return (
        <table>
          <thead>
            <tr>
              {t.columns.map((c) => (
                <th key={c.id}>{c.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows(t).map((r) => (
              <tr key={r.id}>
                {t.columns.map((c) => (
                  <td key={c.id}>{show(c.type, r.cells[c.id])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    },
  },
);
