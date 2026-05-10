import type { UserRole } from "@/components/AuthProvider";

export interface Question {
  id: string;
  author_id: string;
  title: string;
  body: string;
  tags: string[];
  score: number;
  answer_count: number;
  view_count: number;
  solved: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    reputation: number;
    role: UserRole;
  };
}

export interface Answer {
  id: string;
  question_id: string;
  author_id: string;
  body: string;
  score: number;
  accepted: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    reputation: number;
    role: UserRole;
  };
}

export interface Comment {
  id: string;
  parent_type: "question" | "answer";
  parent_id: string;
  author_id: string;
  body: string;
  score: number;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    username: string;
    full_name: string;
    avatar_url: string | null;
    reputation: number;
    role: UserRole;
  };
}

export type SortMode = "newest" | "top" | "unanswered" | "solved";
