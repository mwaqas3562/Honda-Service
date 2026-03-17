"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Search, Package } from "lucide-react";
import Fuse, { type FuseResult as FuseResultType } from "fuse.js";

export interface SearchablePart {
  id: number;
  name: string;
  partNumber: string;
  salePrice: number;
  stock: number;
  aliases: string[];
  usageCount: number;
}

interface SmartPartSearchProps {
  parts: SearchablePart[];
  excludeIds?: Set<number>;
  onSelect: (part: SearchablePart) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

type FResult = FuseResultType<SearchablePart>;

// Highlight matched characters in text
function HighlightText({ text, indices }: { text: string; indices?: readonly [number, number][] }) {
  if (!indices || indices.length === 0) return <>{text}</>;

  const parts: JSX.Element[] = [];
  let lastEnd = 0;

  for (const [start, end] of indices) {
    if (start > lastEnd) {
      parts.push(<span key={`t-${lastEnd}`}>{text.slice(lastEnd, start)}</span>);
    }
    parts.push(
      <mark key={`h-${start}`} className="bg-yellow-200 text-gray-900 rounded-sm px-0">
        {text.slice(start, end + 1)}
      </mark>
    );
    lastEnd = end + 1;
  }
  if (lastEnd < text.length) {
    parts.push(<span key={`t-${lastEnd}`}>{text.slice(lastEnd)}</span>);
  }

  return <>{parts}</>;
}

export default function SmartPartSearch({
  parts,
  excludeIds,
  onSelect,
  placeholder = "Type part name, local name, or number...",
  autoFocus = false,
}: SmartPartSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Available parts = in-stock and not excluded
  const available = useMemo(() => {
    return parts.filter((p) => p.stock > 0 && !(excludeIds?.has(p.id)));
  }, [parts, excludeIds]);

  // Top 10 most-used parts (default when no query)
  const topParts = useMemo(() => {
    return [...available].sort((a, b) => b.usageCount - a.usageCount).slice(0, 10);
  }, [available]);

  // Fuse index — rebuilt when available parts change
  const fuse = useMemo(() => {
    return new Fuse(available, {
      keys: [
        { name: "name", weight: 0.5 },
        { name: "aliases", weight: 0.35 },
        { name: "partNumber", weight: 0.15 },
      ],
      threshold: 0.4,
      distance: 100,
      includeScore: true,
      includeMatches: true,
      minMatchCharLength: 1,
    });
  }, [available]);

  // Search results — sorted by score then usageCount
  const results: FResult[] = useMemo(() => {
    if (!query.trim()) return [];
    const raw = fuse.search(query, { limit: 30 });
    // Stable sort: close scores grouped, then by usageCount
    return raw.sort((a, b) => {
      const scoreDiff = (a.score || 0) - (b.score || 0);
      if (Math.abs(scoreDiff) > 0.05) return scoreDiff;
      return (b.item.usageCount || 0) - (a.item.usageCount || 0);
    }).slice(0, 20);
  }, [fuse, query]);

  // What to show in dropdown
  const displayItems: FResult[] = useMemo(() => {
    if (query.trim()) {
      return results;
    }
    // No query → show top used as pseudo-results (no match highlighting)
    return topParts.map((item) => ({ item, score: undefined, matches: undefined, refIndex: 0 }));
  }, [query, results, topParts]);

  const noResults = query.trim().length > 0 && results.length === 0;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Scroll highlighted item into view
  useEffect(() => {
    if (!isOpen || !dropdownRef.current) return;
    const el = dropdownRef.current.children[highlight] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, isOpen]);

  const handleSelect = useCallback((part: SearchablePart) => {
    onSelect(part);
    setQuery("");
    setIsOpen(false);
    setHighlight(0);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [onSelect]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen || displayItems.length === 0) {
      // Open dropdown on arrow down even when closed
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setIsOpen(true);
        return;
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, displayItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(displayItems[highlight].item);
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  }

  // Get match info for a result
  function getMatchInfo(result: FResult) {
    if (!result.matches) return { nameIndices: undefined, aliasMatch: undefined };

    let nameIndices: readonly [number, number][] | undefined;
    let aliasMatch: string | undefined;
    let aliasIndices: readonly [number, number][] | undefined;

    for (const m of result.matches) {
      if (m.key === "name") {
        nameIndices = m.indices as readonly [number, number][];
      } else if (m.key === "aliases" && m.value) {
        aliasMatch = m.value;
        aliasIndices = m.indices as readonly [number, number][];
      }
    }

    return { nameIndices, aliasMatch, aliasIndices };
  }

  return (
    <div ref={containerRef} className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
          setHighlight(0);
        }}
        onFocus={() => setIsOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white transition-shadow"
        autoComplete="off"
      />

      {isOpen && (displayItems.length > 0 || noResults) && (
        <div
          ref={dropdownRef}
          className="absolute z-30 left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-72 overflow-y-auto"
        >
          {/* Header label */}
          {!query.trim() && displayItems.length > 0 && (
            <div className="px-4 py-2 text-xs font-medium text-gray-400 bg-gray-50 border-b border-gray-100 flex items-center gap-1.5">
              <Package className="w-3 h-3" /> Most Used Parts
            </div>
          )}

          {noResults && (
            <div className="px-4 py-4 text-sm text-center">
              <p className="text-gray-400">No exact match found for &ldquo;{query}&rdquo;</p>
              {available.length > 0 && (
                <p className="text-xs text-gray-300 mt-1">Try a different spelling or local name</p>
              )}
            </div>
          )}

          {displayItems.map((result, idx) => {
            const p = result.item;
            const { nameIndices, aliasMatch, aliasIndices } = getMatchInfo(result);
            const isHighlighted = idx === highlight;

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelect(p)}
                className={`w-full text-left px-4 py-3 text-sm border-b border-gray-50 last:border-0 flex justify-between items-center transition-colors ${
                  isHighlighted ? "bg-red-50" : "hover:bg-gray-50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 truncate">
                    <HighlightText text={p.name} indices={nameIndices} />
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{p.partNumber}</span>
                    {aliasMatch && (
                      <span className="text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                        aka: <HighlightText text={aliasMatch} indices={aliasIndices} />
                      </span>
                    )}
                    {!aliasMatch && p.aliases.length > 0 && !query.trim() && (
                      <span className="text-gray-400 italic truncate max-w-[180px]">
                        {p.aliases.slice(0, 3).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right ml-4 shrink-0">
                  <div className="font-bold text-gray-900">Rs {Math.round(p.salePrice).toLocaleString()}</div>
                  <div className={`text-xs mt-0.5 ${p.stock <= 3 ? "text-red-500 font-medium" : "text-gray-400"}`}>
                    Stock: {p.stock}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
