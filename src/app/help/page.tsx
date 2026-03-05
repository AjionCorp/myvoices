import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/ui/Footer";

export const metadata: Metadata = {
  title: "Help & FAQ",
  description: "Frequently asked questions about myVoice.",
};

const faqs = [
  {
    q: "What is myVoice?",
    a: "myVoice is a video canvas platform where communities curate the best YouTube, TikTok, and BiliBili videos. Videos are organized into topics and ranked by community votes.",
  },
  {
    q: "How do I add a video?",
    a: "Navigate to a topic, click the \"+\" button, paste a YouTube or TikTok URL, and claim a spot on the grid. Your video will appear on the canvas immediately.",
  },
  {
    q: "How does voting work?",
    a: "Click the thumbs up or thumbs down on any video. The most-liked videos move closer to the center of the spiral — the prime real estate of each topic.",
  },
  {
    q: "What are contests?",
    a: "Contests are time-limited competitions where the highest-liked videos win cash prizes. Payouts are sent directly to your bank account via Stripe Connect.",
  },
  {
    q: "How do I receive prize money?",
    a: "Go to your Earnings page and connect a Stripe account. Once connected, prize payouts will be deposited directly into your bank account.",
  },
  {
    q: "Is the API free?",
    a: "Yes! You get 1,000 free API requests per day. Need more? Purchase credit packs on the Developer Portal.",
  },
  {
    q: "How do I create a topic?",
    a: "Sign in and click \"Create\" in the header. Give your topic a title, description, and category. You'll become its owner and first moderator.",
  },
  {
    q: "How do I report inappropriate content?",
    a: "Click the three-dot menu on any user card and select \"Report\". Our moderation team reviews all reports.",
  },
];

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
          &larr; Back to Canvas
        </Link>
        <h1 className="mb-8 text-3xl font-bold text-foreground">Help & FAQ</h1>

        <div className="space-y-6">
          {faqs.map((faq, i) => (
            <div key={i} className="rounded-xl border border-border bg-surface p-5">
              <h3 className="mb-2 text-sm font-semibold text-foreground">{faq.q}</h3>
              <p className="text-sm leading-relaxed text-muted">{faq.a}</p>
            </div>
          ))}
        </div>

        <p className="mt-8 text-sm text-muted">
          Still have questions? Email us at{" "}
          <a href="mailto:hello@myvoice.app" className="text-accent hover:underline">hello@myvoice.app</a>.
        </p>
      </div>
      <Footer />
    </div>
  );
}
