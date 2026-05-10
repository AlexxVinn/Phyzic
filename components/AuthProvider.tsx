"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase";
import type { User, Session } from "@supabase/supabase-js";

export type UserRole = 'admin' | 'moderator' | 'verified' | 'contributor' | 'user';
export type UserStatus = 'active' | 'warned' | 'suspended' | 'banned';

export interface Profile {
  id: string;
  username: string;
  full_name: string;
  bio: string;
  avatar_url: string | null;
  reputation: number;
  role: UserRole;
  status: UserStatus;
  status_expires_at: string | null;
  status_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: (force?: boolean) => Promise<Profile | null>;
  updateProfile: (fields: Partial<Profile>) => Promise<Profile>;
  uploadAvatar: (file: File) => Promise<string>;
  fetchProfile: (userId: string) => Promise<Profile | null>;
  fetchProfileByUsername: (username: string) => Promise<Profile | null>;
  signInEmail: (email: string, password: string) => Promise<{ user: User | null; session: Session | null }>;
  signUpEmail: (email: string, password: string, username: string) => Promise<{ user: User | null; session: Session | null }>;
  signInGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  fetchReputationHistory: (userId: string, limit?: number) => Promise<any[]>;
  fetchUserQuestions: (userId: string, limit?: number, offset?: number) => Promise<any[]>;
  fetchUserAnswers: (userId: string, limit?: number, offset?: number) => Promise<any[]>;
  fetchUserSavedPosts: (userId: string, limit?: number, offset?: number) => Promise<any[]>;
  fetchUserTopTags: (userId: string) => Promise<any[]>;
  fetchUserActivity: (userId: string, limit?: number) => Promise<any[]>;
  fetchFollowStatus: (viewerId: string, targetId: string) => Promise<{ following: boolean; followers: number; followingCount: number }>;
  followUser: (targetId: string) => Promise<void>;
  unfollowUser: (targetId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileFetchTs, setProfileFetchTs] = useState(0);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!userId) return null;
    try {
      const res = await supabase
        .from("profiles")
        .select("id,username,full_name,bio,avatar_url,reputation,role,status,status_expires_at,status_reason,created_at,updated_at")
        .eq("id", userId)
        .maybeSingle();
      if (res.error) {
        if (res.error.code === "404" || res.error.code === "PGRST116") return null;
        console.warn("fetchProfile:", res.error.message);
        return null;
      }
      return res.data as Profile | null;
    } catch (e) {
      return null;
    }
  }, [supabase]);

  const fetchProfileByUsername = useCallback(async (username: string) => {
    if (!username) return null;
    try {
      const res = await supabase
        .from("profiles")
        .select("id,username,full_name,bio,avatar_url,reputation,role,status,status_expires_at,status_reason,created_at,updated_at")
        .eq("username", username)
        .maybeSingle();
      if (res.error) {
        if (res.error.code === "404" || res.error.code === "PGRST116") return null;
        console.warn("fetchProfileByUsername:", res.error.message);
        return null;
      }
      return res.data as Profile | null;
    } catch (e) {
      return null;
    }
  }, [supabase]);

  const refreshProfile = useCallback(async (force?: boolean) => {
    const { data } = await supabase.auth.getSession();
    const s = data.session;
    if (!s || !s.user) {
      setProfile(null);
      return null;
    }
    const now = Date.now();
    if (!force && profile && profile.id === s.user.id && now - profileFetchTs < 30000) {
      return profile;
    }
    let p = await fetchProfile(s.user.id);
    if (!p) {
      p = {
        id: s.user.id,
        username: s.user.user_metadata?.username || s.user.email?.split("@")[0] || "user",
        full_name: "",
        bio: "",
        avatar_url: s.user.user_metadata?.avatar_url || null,
        reputation: 0,
        role: "user",
        status: "active",
        status_expires_at: null,
        status_reason: null,
        created_at: s.user.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    setProfile(p);
    setProfileFetchTs(now);
    return p;
  }, [supabase, profile, profileFetchTs, fetchProfile]);

  const updateProfile = useCallback(async (fields: Partial<Profile>) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw new Error("Not authenticated");
    const allowed: Partial<Profile> = {};
    (["username", "full_name", "bio", "avatar_url"] as const).forEach((k) => {
      if (fields.hasOwnProperty(k)) (allowed as any)[k] = fields[k];
    });
    const res = await supabase.from("profiles").update(allowed).eq("id", data.session.user.id).select().single();
    if (res.error) throw res.error;
    const updated = { ...profile, ...allowed, ...res.data } as Profile;
    setProfile(updated);
    setProfileFetchTs(Date.now());
    return updated;
  }, [supabase, profile]);

  const uploadAvatar = useCallback(async (file: File) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw new Error("Not authenticated");
    const ext = (file.name.split(".").pop() || "png").toLowerCase();
    const path = `${data.session.user.id}/${Date.now()}.${ext}`;
    const upsert = await supabase.storage.from("avatars").upload(path, file, { upsert: true, contentType: file.type });
    if (upsert.error) throw upsert.error;
    const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
    await updateProfile({ avatar_url: url });
    return url;
  }, [supabase, updateProfile]);

  const signInEmail = useCallback(async (email: string, password: string) => {
    const res = await supabase.auth.signInWithPassword({ email, password });
    if (res.error) throw res.error;
    setUser(res.data.user);
    setSession(res.data.session);
    await refreshProfile(true);
    return { user: res.data.user, session: res.data.session };
  }, [supabase, refreshProfile]);

  const signUpEmail = useCallback(async (email: string, password: string, username: string) => {
    const res = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    if (res.error) throw res.error;
    setUser(res.data.user);
    setSession(res.data.session);
    await refreshProfile(true);
    return { user: res.data.user, session: res.data.session };
  }, [supabase, refreshProfile]);

  const signInGoogle = useCallback(async () => {
    const redirectTo = new URL("auth/callback", window.location.href).href;
    const res = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (res.error) throw res.error;
  }, [supabase]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  }, [supabase]);

  const fetchReputationHistory = useCallback(async (userId: string, limit = 20) => {
    const res = await supabase
      .from("reputation_history")
      .select("id,delta,reason,source_type,source_id,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (res.error) throw res.error;
    return res.data || [];
  }, [supabase]);

  const fetchUserQuestions = useCallback(async (userId: string, limit = 20, offset = 0) => {
    const res = await supabase
      .from("questions")
      .select("id,title,body,tags,score,answer_count,view_count,solved,created_at")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (res.error) throw res.error;
    return res.data || [];
  }, [supabase]);

  const fetchUserAnswers = useCallback(async (userId: string, limit = 20, offset = 0) => {
    const res = await supabase
      .from("answers")
      .select("id,question_id,body,score,accepted,created_at,questions:question_id(title)")
      .eq("author_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (res.error) throw res.error;
    return res.data || [];
  }, [supabase]);

  const fetchUserSavedPosts = useCallback(async (userId: string, limit = 20, offset = 0) => {
    const res = await supabase
      .from("saved_posts")
      .select("post_type,post_id,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);
    if (res.error) throw res.error;
    return res.data || [];
  }, [supabase]);

  const fetchUserTopTags = useCallback(async (userId: string) => {
    const res = await supabase.from("questions").select("tags").eq("author_id", userId);
    if (res.error) throw res.error;
    const counts: Record<string, number> = {};
    (res.data || []).forEach((q: any) => {
      (q.tags || []).forEach((t: string) => {
        counts[t] = (counts[t] || 0) + 1;
      });
    });
    return Object.keys(counts)
      .map((t) => ({ tag: t, count: counts[t] }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [supabase]);

  const fetchUserActivity = useCallback(async (userId: string, limit = 20) => {
    const res = await supabase
      .from("reputation_history")
      .select("id,delta,reason,source_type,source_id,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (res.error) throw res.error;
    return res.data || [];
  }, [supabase]);

  const fetchFollowStatus = useCallback(async (viewerId: string, targetId: string) => {
    if (!viewerId || !targetId || viewerId === targetId) return { following: false, followers: 0, followingCount: 0 };
    const followingRes = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", viewerId)
      .eq("following_id", targetId);
    const followersRes = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("following_id", targetId);
    const followingCountRes = await supabase
      .from("follows")
      .select("*", { count: "exact", head: true })
      .eq("follower_id", targetId);
    return {
      following: (followingRes.count || 0) > 0,
      followers: followersRes.count || 0,
      followingCount: followingCountRes.count || 0,
    };
  }, [supabase]);

  const followUser = useCallback(async (targetId: string) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw new Error("Not authenticated");
    if (data.session.user.id === targetId) throw new Error("Cannot follow yourself");
    const res = await supabase.from("follows").insert({ follower_id: data.session.user.id, following_id: targetId });
    if (res.error) throw res.error;
  }, [supabase]);

  const unfollowUser = useCallback(async (targetId: string) => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw new Error("Not authenticated");
    const res = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", data.session.user.id)
      .eq("following_id", targetId);
    if (res.error) throw res.error;
  }, [supabase]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchProfile(data.session.user.id).then((p) => {
          if (p) {
            setProfile(p);
            setProfileFetchTs(Date.now());
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        fetchProfile(newSession.user.id).then((p) => {
          if (p) {
            setProfile(p);
            setProfileFetchTs(Date.now());
          }
        });
      } else {
        setProfile(null);
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        refreshProfile,
        updateProfile,
        uploadAvatar,
        fetchProfile,
        fetchProfileByUsername,
        signInEmail,
        signUpEmail,
        signInGoogle,
        signOut,
        fetchReputationHistory,
        fetchUserQuestions,
        fetchUserAnswers,
        fetchUserSavedPosts,
        fetchUserTopTags,
        fetchUserActivity,
        fetchFollowStatus,
        followUser,
        unfollowUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
