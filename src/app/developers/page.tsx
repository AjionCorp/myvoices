"use client";

import { useState } from "react";
import { Copy, Check, Key, Zap, Code2, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_CREDIT_TIERS = [
  { id: "starter", credits: 5_000, priceCents: 500, label: "5K requests", price: "$5" },
  { id: "growth", credits: 50_000, priceCents: 2500, label: "50K requests", price: "$25" },
  { id: "scale", credits: 500_000, priceCents: 10000, label: "500K requests", price: "$100" },
] as const;

const ENDPOINTS = [
  { method: "GET", path: "/api/v1/topics", description: "List all topics with stats" },
  { method: "GET", path: "/api/v1/topics/:slug", description: "Single topic detail + top 20 blocks" },
  { method: "GET", path: "/api/v1/topics/:slug/comments", description: "Paginated comments (blockId, limit, offset)" },
  { method: "GET", path: "/api/v1/data", description: "Viewport-scoped blocks + comments" },
  { method: "GET", path: "/api/v1/compare", description: "Compare 2-4 topics by slug" },
  { method: "GET", path: "/api/v1/users/:username", description: "Public user profile" },
  { method: "GET", path: "/api/v1/stats", description: "Platform-wide statistics" },
  { method: "GET", path: "/api/v1/developers/me", description: "Your API key info & usage" },
];

export default function DevelopersPage() {
  // Registration
  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [registering, setRegistering] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showKey, setShowKey] = useState(true);

  // Key lookup
  const [lookupKey, setLookupKey] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [keyInfo, setKeyInfo] = useState<Record<string, unknown> | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Purchase
  const [purchasing, setPurchasing] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!regName.trim() || !regEmail.trim()) {
      setRegError("Name and email are required");
      return;
    }
    setRegistering(true);
    setRegError(null);
    try {
      const res = await fetch("/api/v1/developers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: regName.trim(), email: regEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRegError(data.error || "Registration failed");
        return;
      }
      setApiKey(data.apiKey);
    } catch {
      setRegError("Network error. Please try again.");
    } finally {
      setRegistering(false);
    }
  };

  const handleCopy = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleLookup = async () => {
    if (!lookupKey.trim()) return;
    setLookupLoading(true);
    setLookupError(null);
    try {
      const res = await fetch("/api/v1/developers/me", {
        headers: { "x-api-key": lookupKey.trim() },
      });
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error || "Invalid key");
        setKeyInfo(null);
        return;
      }
      setKeyInfo(data);
    } catch {
      setLookupError("Network error");
    } finally {
      setLookupLoading(false);
    }
  };

  const handlePurchase = async (tierId: string) => {
    const key = lookupKey.trim() || apiKey;
    if (!key) {
      setLookupError("Enter your API key first to purchase credits");
      return;
    }
    setPurchasing(tierId);
    try {
      const res = await fetch("/api/v1/developers/purchase-credits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": key,
        },
        body: JSON.stringify({ tier: tierId }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setLookupError(data.error || "Failed to create checkout");
      }
    } catch {
      setLookupError("Network error");
    } finally {
      setPurchasing(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="mx-auto max-w-4xl px-6 py-16">
        {/* Hero */}
        <div className="mb-16 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/60">
            <Code2 className="h-4 w-4" />
            Developer API
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight">
            Build with myVOice
          </h1>
          <p className="mx-auto max-w-lg text-lg text-white/50">
            Access topics, videos, comments, and user profiles through our REST API.
            1,000 free requests per day. No account needed.
          </p>
        </div>

        {/* Register */}
        <section className="mb-12 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Key className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold">Get Your API Key</h2>
          </div>

          {apiKey ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                <p className="mb-2 text-sm font-medium text-green-400">
                  Your API key has been created. Save it now — it won&apos;t be shown again.
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-black/40 px-3 py-2 font-mono text-sm text-white/90">
                    {showKey ? apiKey : "mv_" + "•".repeat(32)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white/50 hover:text-white"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-white/50 hover:text-white"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="text"
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Your name or app name"
                  className="rounded-lg border-white/10 bg-white/5 py-2.5 text-white placeholder:text-white/30 focus:border-accent/50"
                />
                <Input
                  type="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="Email address"
                  className="rounded-lg border-white/10 bg-white/5 py-2.5 text-white placeholder:text-white/30 focus:border-accent/50"
                />
              </div>
              {regError && <p className="text-xs text-red-400">{regError}</p>}
              <Button
                onClick={handleRegister}
                disabled={registering}
                className="bg-accent text-white hover:bg-accent/90"
              >
                {registering ? "Creating..." : "Create API Key"}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </section>

        {/* Key Management */}
        <section className="mb-12 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="mb-4 text-lg font-semibold">Manage Your Key</h2>
          <div className="flex gap-2">
            <Input
              type="text"
              value={lookupKey}
              onChange={(e) => setLookupKey(e.target.value)}
              placeholder="Enter your API key (mv_...)"
              className="flex-1 rounded-lg border-white/10 bg-white/5 py-2.5 font-mono text-white placeholder:text-white/30 focus:border-accent/50"
            />
            <Button
              onClick={handleLookup}
              disabled={lookupLoading}
              variant="outline"
              className="border-white/10 text-white hover:bg-white/10"
            >
              {lookupLoading ? "Loading..." : "Look Up"}
            </Button>
          </div>
          {lookupError && <p className="mt-2 text-xs text-red-400">{lookupError}</p>}

          {keyInfo && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Key", value: String(keyInfo.keyPrefix ?? "") },
                { label: "Credits", value: Number(keyInfo.credits ?? 0).toLocaleString() },
                { label: "Total Requests", value: Number(keyInfo.totalRequests ?? 0).toLocaleString() },
                {
                  label: "Rate Limit",
                  value: `${Number((keyInfo.rateLimit as Record<string, unknown>)?.remaining ?? 0).toLocaleString()} / 1,000`,
                },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <p className="text-[11px] text-white/40">{item.label}</p>
                  <p className="font-mono text-sm text-white/80">{item.value}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Purchase Credits */}
        <section className="mb-12 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Zap className="h-5 w-5 text-amber-400" />
            <h2 className="text-lg font-semibold">Purchase Credits</h2>
          </div>
          <p className="mb-4 text-sm text-white/50">
            1,000 requests/day are free. Need more? Buy credits — each credit = 1 request beyond the free tier.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {API_CREDIT_TIERS.map((tier) => (
              <Button
                key={tier.id}
                variant="ghost"
                onClick={() => handlePurchase(tier.id)}
                disabled={!!purchasing}
                className="h-auto flex-col rounded-lg border border-white/10 bg-white/5 p-4 text-center hover:border-accent/40 hover:bg-accent/5"
              >
                <span className="text-2xl font-bold text-white">{tier.price}</span>
                <span className="mt-1 text-sm text-white/60">{tier.label}</span>
                <span className="mt-0.5 text-[11px] text-white/30">
                  ${(tier.priceCents / tier.credits * 10).toFixed(2)}/1K req
                </span>
              </Button>
            ))}
          </div>
        </section>

        {/* API Reference */}
        <section className="mb-12 rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="mb-4 text-lg font-semibold">API Reference</h2>

          {/* Auth */}
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-white/70">Authentication</h3>
            <p className="mb-2 text-sm text-white/50">
              Include your API key in the <code className="rounded bg-white/10 px-1.5 py-0.5 text-xs">x-api-key</code> header:
            </p>
            <pre className="overflow-x-auto rounded-lg bg-black/40 p-4 text-xs leading-relaxed text-white/70">
{`curl -H "x-api-key: mv_your_key_here" \\
  https://myvoice.app/api/v1/topics`}
            </pre>
          </div>

          {/* Rate Limits */}
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-medium text-white/70">Rate Limits</h3>
            <p className="text-sm text-white/50">
              1,000 free requests/day. Beyond that, 1 credit = 1 request.
              Rate limit info is in response headers:
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-black/40 p-3 text-xs text-white/50">
{`X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 742
X-RateLimit-Reset: 1709596800`}
            </pre>
          </div>

          {/* Endpoints */}
          <div>
            <h3 className="mb-3 text-sm font-medium text-white/70">Endpoints</h3>
            <div className="space-y-1">
              {ENDPOINTS.map((ep) => (
                <div
                  key={ep.path}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-white/5"
                >
                  <span className="w-10 shrink-0 font-mono text-xs font-bold text-green-400">
                    {ep.method}
                  </span>
                  <code className="shrink-0 font-mono text-xs text-white/70">
                    {ep.path}
                  </code>
                  <span className="text-xs text-white/40">
                    {ep.description}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Start */}
        <section className="rounded-xl border border-white/10 bg-white/[0.02] p-6">
          <h2 className="mb-4 text-lg font-semibold">Quick Start</h2>
          <pre className="overflow-x-auto rounded-lg bg-black/40 p-4 text-xs leading-relaxed text-white/70">
{`// JavaScript / TypeScript
const API_KEY = "mv_your_key_here";
const BASE = "https://myvoice.app";

// List all topics
const topics = await fetch(\`\${BASE}/api/v1/topics\`, {
  headers: { "x-api-key": API_KEY },
}).then(r => r.json());

// Get a specific topic with top videos
const topic = await fetch(\`\${BASE}/api/v1/topics/music\`, {
  headers: { "x-api-key": API_KEY },
}).then(r => r.json());

// Get a user profile
const user = await fetch(\`\${BASE}/api/v1/users/janedoe\`, {
  headers: { "x-api-key": API_KEY },
}).then(r => r.json());

// Platform stats
const stats = await fetch(\`\${BASE}/api/v1/stats\`, {
  headers: { "x-api-key": API_KEY },
}).then(r => r.json());`}
          </pre>
        </section>
      </div>
    </div>
  );
}