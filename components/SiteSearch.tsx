"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { KIND_LABELS, KIND_ORDER, searchEntries, type SearchEntry } from "@/lib/site-search";

/**
 * Jump-to-page search for the homepage header: members, justices, committees
 * and section pages. The index is static JSON (/api/search-index), fetched on
 * first focus so it costs nothing until used. Results are grouped by kind;
 * arrow keys move, Enter goes, Escape closes, "/" focuses.
 */
export function SiteSearch() {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const [entries, setEntries] = useState<SearchEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  function load() {
    if (entries || failed) return;
    fetch("/api/search-index")
      .then((r) => (r.ok ? (r.json() as Promise<SearchEntry[]>) : Promise.reject()))
      .then(setEntries)
      .catch(() => setFailed(true));
  }

  const results = useMemo(() => (entries ? searchEntries(entries, query) : []), [entries, query]);
  // Group in display order but keep one flat list so arrow keys cross groups.
  const flat = useMemo(
    () => KIND_ORDER.flatMap((k) => results.filter((r) => r.k === k)),
    [results],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onDown);
    };
  }, []);

  function go(entry: SearchEntry) {
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    router.push(entry.u);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" && flat.length) {
      e.preventDefault();
      setOpen(true);
      setActive((a) => (a + 1) % flat.length);
    } else if (e.key === "ArrowUp" && flat.length) {
      e.preventDefault();
      setActive((a) => (a - 1 + flat.length) % flat.length);
    } else if (e.key === "Enter" && open && flat[active]) {
      e.preventDefault();
      go(flat[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  const showMenu = open && query.trim() !== "";
  let index = -1;

  return (
    <div ref={rootRef} className="ml-auto min-w-0 self-center pl-2 pr-4 md:relative md:px-0">
      <div className="flex h-8 w-48 items-center gap-2 rounded-md border border-line-strong bg-surface-raised px-2.5 text-ink focus-within:border-accent md:h-9 md:w-60">
        <svg aria-hidden width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" className="flex-none text-ink-faint">
          <circle cx="7" cy="7" r="5" />
          <path d="M11 11l4 4" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={showMenu}
          aria-controls={listId}
          aria-activedescendant={showMenu && flat[active] ? `${listId}-${active}` : undefined}
          aria-label="Search members, justices, committees and pages"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search"
          value={query}
          onFocus={() => {
            load();
            setOpen(true);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={onInputKey}
          className="min-w-0 flex-1 bg-transparent text-base md:text-[0.85rem] placeholder:text-ink-faint focus:outline-none"
        />
        <kbd aria-hidden className="hidden rounded border border-line px-1 font-mono text-[0.65rem] text-ink-faint md:inline">
          /
        </kbd>
      </div>

      {showMenu && (
        <div
          id={listId}
          role="listbox"
          aria-label="Search results"
          className="absolute left-4 right-4 top-full z-30 mt-1 max-h-[70vh] overflow-y-auto rounded-lg border border-line-strong bg-surface p-1.5 shadow-lg md:left-auto md:right-0 md:w-[22rem]"
        >
          {failed ? (
            <p className="px-2.5 py-2 text-[0.8rem] text-ink-muted">Search is unavailable right now.</p>
          ) : !entries ? (
            <p className="px-2.5 py-2 text-[0.8rem] text-ink-muted">Loading…</p>
          ) : flat.length === 0 ? (
            <p className="px-2.5 py-2 text-[0.8rem] text-ink-muted">No matches for “{query.trim()}”.</p>
          ) : (
            KIND_ORDER.map((kind) => {
              const group = flat.filter((r) => r.k === kind);
              if (group.length === 0) return null;
              return (
                <div key={kind} role="group" aria-label={KIND_LABELS[kind]}>
                  <div className="px-2.5 pb-1 pt-2 font-mono text-[0.62rem] uppercase tracking-[0.12em] text-ink-faint">
                    {KIND_LABELS[kind]}
                  </div>
                  {group.map((r) => {
                    index += 1;
                    const i = index;
                    return (
                      <Link
                        key={r.u}
                        id={`${listId}-${i}`}
                        role="option"
                        aria-selected={i === active}
                        href={r.u}
                        onClick={() => setOpen(false)}
                        onMouseEnter={() => setActive(i)}
                        className={`flex items-baseline justify-between gap-3 rounded px-2.5 py-1.5 text-[0.85rem] ${
                          i === active ? "bg-accent/10 text-ink" : "text-ink"
                        }`}
                      >
                        <span className="min-w-0 truncate">{r.n}</span>
                        <span className="flex-none text-[0.72rem] text-ink-muted">{r.s}</span>
                      </Link>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
