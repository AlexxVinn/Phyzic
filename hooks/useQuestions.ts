"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase";
import type { Question, Answer, Comment, SortMode } from "@/lib/questions";

export function useQuestionsFeed(sort: SortMode = "newest", tagFilter: string | null = null, searchQuery: string | null = null, limit = 20) {
  const supabase = createClient();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const offsetRef = useRef(0);

  const load = useCallback(async (reset = false) => {
    setLoading(true);
    setError("");
    try {
      const newOffset = reset ? 0 : offsetRef.current;
      let query = supabase
        .from("questions")
        .select(`
          id,author_id,title,body,tags,score,answer_count,view_count,solved,created_at,updated_at,
          author:profiles!questions_author_id_fkey(id,username,full_name,avatar_url,reputation,role)
        `)
        .order(sort === "top" ? "score" : "created_at", { ascending: false })
        .range(newOffset, newOffset + limit - 1);

      if (tagFilter) {
        query = query.contains("tags", [tagFilter]);
      }
      if (searchQuery) {
        query = query.ilike("search_text", `%${searchQuery}%`);
      }
      if (sort === "unanswered") {
        query = query.eq("answer_count", 0);
      }
      if (sort === "solved") {
        query = query.eq("solved", true);
      }

      const { data, error: err } = await query;
      if (err) throw err;

      const mapped = (data || []).map((q: any) => ({
        ...q,
        author: Array.isArray(q.author) ? q.author[0] : q.author,
      })) as Question[];

      if (reset) {
        setQuestions(mapped);
      } else {
        setQuestions((prev) => [...prev, ...mapped]);
      }
      setHasMore((data || []).length === limit);
      offsetRef.current = newOffset + (data || []).length;
    } catch (e: any) {
      setError(e.message || "Failed to load questions");
    } finally {
      setLoading(false);
    }
  }, [supabase, sort, tagFilter, searchQuery, limit]);

  useEffect(() => {
    offsetRef.current = 0;
    load(true);
  }, [sort, tagFilter, searchQuery, load]);

  useEffect(() => {
    const channel = supabase
      .channel("questions-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "questions" }, () => {
        load(true);
      })
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [supabase, load]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) load(false);
  }, [loading, hasMore, load]);

  return { questions, loading, error, hasMore, loadMore, refresh: () => load(true) };
}

export function useQuestion(id: string | null) {
  const supabase = createClient();
  const [question, setQuestion] = useState<Question | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [answerComments, setAnswerComments] = useState<Record<string, Comment[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userVotes, setUserVotes] = useState<Record<string, number>>({});
  const viewedRef = useRef(false);

  const loadVotes = useCallback(async () => {
    if (!id) return;
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) return;
    const userId = sessionData.session.user.id;
    const { data } = await supabase
      .from("votes")
      .select("target_type,target_id,value")
      .eq("user_id", userId)
      .in("target_type", ["question", "answer"]);
    if (data) {
      const map: Record<string, number> = {};
      data.forEach((v: any) => {
        map[`${v.target_type}:${v.target_id}`] = v.value;
      });
      setUserVotes(map);
    }
  }, [supabase, id]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const [qRes, aRes, cRes] = await Promise.all([
        supabase
          .from("questions")
          .select(`
            id,author_id,title,body,tags,score,answer_count,view_count,solved,created_at,updated_at,
            author:profiles!questions_author_id_fkey(id,username,full_name,avatar_url,reputation,role)
          `)
          .eq("id", id)
          .single(),
        supabase
          .from("answers")
          .select(`
            id,question_id,author_id,body,score,accepted,created_at,updated_at,
            author:profiles!answers_author_id_fkey(id,username,full_name,avatar_url,reputation,role)
          `)
          .eq("question_id", id)
          .order("accepted", { ascending: false })
          .order("score", { ascending: false })
          .order("created_at", { ascending: false }),
        supabase
          .from("comments")
          .select(`
            id,parent_type,parent_id,author_id,body,score,created_at,updated_at,
            author:profiles!comments_author_id_fkey(id,username,full_name,avatar_url,reputation,role)
          `)
          .eq("parent_type", "question")
          .eq("parent_id", id)
          .order("created_at", { ascending: true }),
      ]);

      if (qRes.error) throw qRes.error;
      setQuestion({ ...qRes.data, author: Array.isArray(qRes.data.author) ? qRes.data.author[0] : qRes.data.author } as Question);

      const ans = ((aRes.data || []) as any[]).map((a) => ({ ...a, author: Array.isArray(a.author) ? a.author[0] : a.author })) as Answer[];
      setAnswers(ans);

      setComments(((cRes.data || []) as any[]).map((c) => ({ ...c, author: Array.isArray(c.author) ? c.author[0] : c.author })) as Comment[]);

      // Load answer comments
      if (ans.length > 0) {
        const { data: acRes } = await supabase
          .from("comments")
          .select(`
            id,parent_type,parent_id,author_id,body,score,created_at,updated_at,
            author:profiles!comments_author_id_fkey(id,username,full_name,avatar_url,reputation,role)
          `)
          .eq("parent_type", "answer")
          .in("parent_id", ans.map((a) => a.id))
          .order("created_at", { ascending: true });
        const acMap: Record<string, Comment[]> = {};
        ((acRes || []) as any[]).forEach((c) => {
          const mapped = { ...c, author: Array.isArray(c.author) ? c.author[0] : c.author } as Comment;
          if (!acMap[c.parent_id]) acMap[c.parent_id] = [];
          acMap[c.parent_id].push(mapped);
        });
        setAnswerComments(acMap);
      } else {
        setAnswerComments({});
      }

      if (!viewedRef.current) {
        viewedRef.current = true;
        try { await supabase.rpc("increment_question_views", { p_question_id: id }); } catch {}
      }
    } catch (e: any) {
      setError(e.message || "Failed to load question");
    } finally {
      setLoading(false);
    }
  }, [supabase, id]);

  useEffect(() => {
    viewedRef.current = false;
    load();
    loadVotes();
  }, [id, load, loadVotes]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`question-${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "questions", filter: `id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "answers", filter: `question_id=eq.${id}` }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "comments", filter: `parent_id=eq.${id}` }, () => load())
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [supabase, id, load]);

  const addAnswer = useCallback((answer: Answer) => {
    setAnswers((prev) => [answer, ...prev]);
    setQuestion((q) => q ? { ...q, answer_count: q.answer_count + 1 } : q);
  }, []);

  const updateAnswer = useCallback((answerId: string, body: string) => {
    setAnswers((prev) => prev.map((a) => (a.id === answerId ? { ...a, body, updated_at: new Date().toISOString() } : a)));
  }, []);

  const removeAnswer = useCallback((answerId: string) => {
    setAnswers((prev) => prev.filter((a) => a.id !== answerId));
    setQuestion((q) => q ? { ...q, answer_count: Math.max(0, q.answer_count - 1) } : q);
    setAnswerComments((prev) => { const copy = { ...prev }; delete copy[answerId]; return copy; });
  }, []);

  const addComment = useCallback((comment: Comment) => {
    if (comment.parent_type === "question") {
      setComments((prev) => [...prev, comment]);
    } else {
      setAnswerComments((prev) => ({
        ...prev,
        [comment.parent_id]: [...(prev[comment.parent_id] || []), comment],
      }));
    }
  }, []);

  const removeComment = useCallback((commentId: string, parentType?: string, parentId?: string) => {
    if (parentType === "question" || !parentType) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
    if (parentType === "answer" && parentId) {
      setAnswerComments((prev) => ({
        ...prev,
        [parentId]: (prev[parentId] || []).filter((c) => c.id !== commentId),
      }));
    }
  }, []);

  return {
    question,
    answers,
    comments,
    answerComments,
    userVotes,
    setUserVotes,
    loading,
    error,
    refresh: load,
    addAnswer,
    updateAnswer,
    removeAnswer,
    addComment,
    removeComment,
  };
}

export function useTags() {
  const supabase = createClient();
  const [tags, setTags] = useState<{ name: string; question_count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("tags")
      .select("name,question_count")
      .order("question_count", { ascending: false })
      .limit(50)
      .then(({ data, error }) => {
        if (!error) setTags(data || []);
        setLoading(false);
      });
  }, [supabase]);

  return { tags, loading };
}

export function useVote() {
  const supabase = createClient();

  const vote = useCallback(async (targetType: "question" | "answer", targetId: string, value: 1 | -1) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) throw new Error("Not authenticated");

    const { error } = await supabase.from("votes").insert({
      user_id: sessionData.session.user.id,
      target_type: targetType,
      target_id: targetId,
      value,
    });
    if (error) throw error;
  }, [supabase]);

  const unvote = useCallback(async (targetType: "question" | "answer", targetId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) throw new Error("Not authenticated");

    const { error } = await supabase
      .from("votes")
      .delete()
      .eq("user_id", sessionData.session.user.id)
      .eq("target_type", targetType)
      .eq("target_id", targetId);
    if (error) throw error;
  }, [supabase]);

  const getUserVote = useCallback(async (targetType: "question" | "answer", targetId: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session?.user) return 0;

    const { data } = await supabase
      .from("votes")
      .select("value")
      .eq("user_id", sessionData.session.user.id)
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .maybeSingle();
    return data?.value || 0;
  }, [supabase]);

  return { vote, unvote, getUserVote };
}
