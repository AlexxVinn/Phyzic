"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";

export interface SearchResult {
  id: string;
  type: "question" | "tag" | "user";
  title: string;
  subtitle?: string;
  score?: number;
  answer_count?: number;
  tags?: string[];
}

export function useSearch(query: string, limit = 10) {
  const supabase = createClient();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const search = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setResults([]);
        return;
      }
      setLoading(true);
      const term = `%${q.trim()}%`;
      try {
        const [qRes, tRes, uRes] = await Promise.all([
          supabase
            .from("questions")
            .select("id,title,tags,score,answer_count")
            .ilike("title", term)
            .order("score", { ascending: false })
            .limit(limit),
          supabase
            .from("tags")
            .select("name,question_count")
            .ilike("name", term)
            .order("question_count", { ascending: false })
            .limit(limit),
          supabase
            .from("profiles")
            .select("id,username,full_name,reputation")
            .or(`username.ilike.${q.trim()},full_name.ilike.${term}`)
            .order("reputation", { ascending: false })
            .limit(limit),
        ]);

        const out: SearchResult[] = [];
        if (!qRes.error && qRes.data) {
          out.push(
            ...(qRes.data as any[]).map((r) => ({
              id: r.id,
              type: "question" as const,
              title: r.title,
              score: r.score,
              answer_count: r.answer_count,
              tags: r.tags,
            }))
          );
        }
        if (!tRes.error && tRes.data) {
          out.push(
            ...(tRes.data as any[]).map((r) => ({
              id: r.name,
              type: "tag" as const,
              title: r.name,
              subtitle: `${r.question_count} questions`,
            }))
          );
        }
        if (!uRes.error && uRes.data) {
          out.push(
            ...(uRes.data as any[]).map((r) => ({
              id: r.id,
              type: "user" as const,
              title: r.full_name || r.username,
              subtitle: `@${r.username} · ${r.reputation} rep`,
            }))
          );
        }
        setResults(out);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    },
    [supabase, limit]
  );

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      search(query);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  return { results, loading };
}
