import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/ui/Footer";

export const metadata: Metadata = {
  title: "About",
  description: "Learn about myVoice — the world's largest video canvas platform.",
};

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
          &larr; Back to Canvas
        </Link>
        <h1 className="mb-6 text-3xl font-bold text-foreground">About myVoice</h1>

        <div className="space-y-6 text-sm leading-relaxed text-muted">
          <p>
            myVoice is the <strong className="text-foreground">1 Million Video Canvas</strong> — a platform where
            communities organize around topics and curate the best video content from YouTube, TikTok, and BiliBili.
          </p>

          <h2 className="text-xl font-semibold text-foreground">How It Works</h2>
          <p>
            Each topic has a spiral grid of video slots. Users claim slots by submitting a video URL. The community
            votes with likes and dislikes — the most popular videos drift toward the center of the spiral, creating
            a living, breathing ranking that evolves over time.
          </p>

          <h2 className="text-xl font-semibold text-foreground">Contests</h2>
          <p>
            Regular contests award cash prizes to the top-liked videos. Winners receive payouts directly through
            Stripe Connect. It&apos;s free to enter — just submit your best content and let the community decide.
          </p>

          <h2 className="text-xl font-semibold text-foreground">For Developers</h2>
          <p>
            We offer a free REST API and MCP server for integrations. Visit our{" "}
            <Link href="/developers" className="text-accent hover:underline">Developer Portal</Link> to get started.
          </p>

          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p>
            Have questions or feedback? Reach out at{" "}
            <a href="mailto:hello@myvoice.app" className="text-accent hover:underline">hello@myvoice.app</a>.
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}
