"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { Header } from "@/components/ui/Header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClearableInput } from "@/components/ui/clearable-input";

interface TopicResult {
  id: number;
  slug: string;
  title: string;
  description: string;
  category: string;
  videoCount: number;
  totalLikes: number;
  totalViews: number;
}

interface UserResult {
  username: string;
  displayName: string;
  bio: string | null;
}

export default function SearchPage() {
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get("q") || "";

  const [query, setQuery] = useState(initialQuery);
  const [topics, setTopics] = useState<TopicResult[]>([]);
  const [users, setUsers] = useState<UserResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setTopics([]);
      setUsers([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setTopics(data.topics || []);
        setUsers(data.users || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }, []);

  useEffect(() => {
    if (initialQuery) doSearch(initialQuery);
  }, [initialQuery, doSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
    // Update URL
    const url = new URL(window.location.href);
    url.searchParams.set("q", query);
    window.history.replaceState({}, "", url.toString());
  };

  const totalResults = topics.length + users.length;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="mx-auto max-w-3xl px-6 py-8">
        <form onSubmit={handleSubmit} className="mb-8">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <ClearableInput
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onClear={() => { setQuery(""); setTopics([]); setUsers([]); setSearched(false); }}
              placeholder="Search topics, users..."
              className="w-full bg-surface pl-10 text-base"
              autoFocus
            />
          </div>
        </form>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        )}

        {!loading && searched && (
          <div>
            <p className="mb-6 text-sm text-muted">
              {totalResults} result{totalResults !== 1 ? "s" : ""} for &ldquo;{searchParams.get("q") || query}&rdquo;
            </p>

            {/* Topics */}
            {topics.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Topics</h2>
                <div className="space-y-2">
                  {topics.map((topic) => (
                    <Link key={topic.id} href={`/t/${topic.slug}`}>
                      <Card className="gap-0 rounded-xl border-border bg-surface py-0 transition-colors hover:bg-surface-light">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h3 className="text-sm font-medium text-foreground">{topic.title}</h3>
                              {topic.description && (
                                <p className="mt-0.5 line-clamp-1 text-xs text-muted">{topic.description}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted">
                              <span>{topic.videoCount} videos</span>
                              <span>{(topic.totalLikes || 0).toLocaleString()} likes</span>
                              {topic.category && (
                                <Badge variant="outline" className="text-[10px]">{topic.category}</Badge>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Users */}
            {users.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-3 text-sm font-semibold text-foreground">Users</h2>
                <div className="space-y-2">
                  {users.map((user) => (
                    <Link key={user.username} href={`/u/${user.username}`}>
                      <Card className="gap-0 rounded-xl border-border bg-surface py-0 transition-colors hover:bg-surface-light">
                        <CardContent className="flex items-center gap-3 p-4">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-xs font-bold text-white">
                            {user.displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-foreground">{user.displayName}</h3>
                            <p className="text-xs text-muted">@{user.username}</p>
                          </div>
                          {user.bio && (
                            <p className="ml-auto line-clamp-1 max-w-[200px] text-xs text-muted">{user.bio}</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {totalResults === 0 && (
              <p className="py-12 text-center text-sm text-muted">
                No results found. Try a different search term.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
