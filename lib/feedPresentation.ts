import type { Question } from "@/lib/questions";

export type FeedCardVariant = "featured" | "standard" | "compact";

export type FeedThreadState =
  | "active"
  | "recently-solved"
  | "controversial"
  | "bounty"
  | "rising"
  | "momentum"
  | "new";

export type FeedLayoutItem = {
  question: Question;
  variant: FeedCardVariant;
  states: FeedThreadState[];
};

export type AuthorFeedIdentity = {
  knownFor?: string;
  streakDays?: number;
  notableLabel?: string;
};

function heatScore(q: Question) {
  const ageH = (Date.now() - new Date(q.created_at).getTime()) / 36e5;
  const fresh = ageH < 48 ? 4 : ageH < 168 ? 2 : 0;
  return (
    q.score * 1.4 +
    Math.min(q.view_count / 40, 16) +
    q.answer_count * 2.5 +
    (q.solved ? 2 : 0) +
    fresh
  );
}

export function classifyThreadStates(q: Question): FeedThreadState[] {
  const now = Date.now();
  const created = new Date(q.created_at).getTime();
  const updated = new Date(q.updated_at).getTime();
  const ageHours = (now - created) / 36e5;
  const hoursSinceUpdate = (now - updated) / 36e5;
  const bumped = updated - created > 36e5;

  const states: FeedThreadState[] = [];

  if (ageHours < 42) states.push("new");
  if (bumped && hoursSinceUpdate < 72 && !q.solved) states.push("active");
  if (q.solved && hoursSinceUpdate < 96) states.push("recently-solved");
  if (q.answer_count >= 2 && q.score <= 2 && !q.solved) states.push("controversial");
  if (q.answer_count === 0 && (q.view_count >= 8 || q.score >= 2)) states.push("bounty");
  if (!q.solved && q.score >= 3 && ageHours < 120) states.push("rising");
  if (q.answer_count >= 3 && hoursSinceUpdate < 120) states.push("momentum");

  return states;
}

export function hasDisplayMath(body: string) {
  return /\$\$[\s\S]+?\$\$/.test(body) || (body.match(/\$/g)?.length ?? 0) >= 4;
}

export function pickFeatured(questions: Question[]): Question | null {
  if (questions.length === 0) return null;
  return [...questions].sort((a, b) => heatScore(b) - heatScore(a))[0];
}

/** Feed: one featured thread, then uniform full-width cards. */
export function buildFeedLayout(questions: Question[]): {
  featured: Question | null;
  items: FeedLayoutItem[];
} {
  const featured = pickFeatured(questions);
  const rest = featured ? questions.filter((q) => q.id !== featured.id) : [...questions];

  const items: FeedLayoutItem[] = rest.map((q) => ({
    question: q,
    variant: "standard" as const,
    states: classifyThreadStates(q),
  }));

  return { featured, items };
}

export function buildAuthorIdentities(questions: Question[]): Map<string, AuthorFeedIdentity> {
  const tagByAuthor = new Map<string, Map<string, number>>();
  const postCount = new Map<string, number>();

  for (const q of questions) {
    if (!q.author) continue;
    const id = q.author.id;
    postCount.set(id, (postCount.get(id) || 0) + 1);
    const tags = tagByAuthor.get(id) || new Map();
    for (const t of q.tags) {
      tags.set(t, (tags.get(t) || 0) + 1);
    }
    tagByAuthor.set(id, tags);
  }

  const out = new Map<string, AuthorFeedIdentity>();
  for (const q of questions) {
    if (!q.author) continue;
    const id = q.author.id;
    if (out.has(id)) continue;

    const tags = tagByAuthor.get(id);
    let knownFor: string | undefined;
    if (tags && tags.size > 0) {
      knownFor = [...tags.entries()].sort((a, b) => b[1] - a[1])[0][0];
    }

    const posts = postCount.get(id) || 0;
    const rep = q.author.reputation || 0;
    let notableLabel: string | undefined;
    if (q.author.role && q.author.role !== "user") notableLabel = "Staff";
    else if (rep >= 2500) notableLabel = "Senior contributor";
    else if (rep >= 800) notableLabel = "Established";
    else if (posts >= 3) notableLabel = "Active this week";

    const streakDays = posts >= 2 ? Math.min(7, posts + 1) : undefined;

    out.set(id, { knownFor, streakDays, notableLabel });
  }

  return out;
}

export function discoverySlices(questions: Question[]) {
  const controversial = [...questions]
    .filter((q) => q.answer_count >= 2 && q.score <= 2 && !q.solved)
    .sort((a, b) => b.answer_count - a.answer_count)
    .slice(0, 4);

  const unresolved = [...questions]
    .filter((q) => q.answer_count === 0)
    .sort((a, b) => b.view_count + b.score * 3 - (a.view_count + a.score * 3))
    .slice(0, 4);

  const risingDerivations = [...questions]
    .filter((q) => hasDisplayMath(q.body))
    .sort((a, b) => b.score + b.answer_count - (a.score + a.answer_count))
    .slice(0, 4);

  const insights = [...questions]
    .filter((q) => q.solved && q.score >= 2)
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, 3);

  const activeDebates = [...questions]
    .filter((q) => !q.solved && q.answer_count >= 2)
    .sort((a, b) => b.answer_count - a.answer_count)
    .slice(0, 4);

  const unexpected = [...questions]
    .filter((q) => {
      const h = (Date.now() - new Date(q.updated_at).getTime()) / 36e5;
      return q.solved && h < 48 && q.view_count >= 10;
    })
    .slice(0, 3);

  return { controversial, unresolved, risingDerivations, insights, activeDebates, unexpected };
}
