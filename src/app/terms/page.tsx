import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/ui/Footer";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "myVoice terms of service.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
          &larr; Back to Canvas
        </Link>
        <h1 className="mb-2 text-3xl font-bold text-foreground">Terms of Service</h1>
        <p className="mb-8 text-sm text-muted">Last updated: March 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
            <p>By accessing or using myVoice, you agree to be bound by these Terms of Service. If you do not agree, do not use the platform.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">2. User Accounts</h2>
            <p>You are responsible for maintaining the security of your account. You must provide accurate information during registration. You must be at least 13 years old to use myVoice.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">3. Content</h2>
            <p>You retain ownership of content you submit. By submitting videos, you grant myVoice a non-exclusive license to display them on the platform. You must have the right to share any content you submit. Prohibited content includes: illegal material, harassment, spam, and content that violates third-party rights.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">4. Contests & Prizes</h2>
            <p>Contest rules, eligibility, and prize amounts are specified at contest creation. myVoice reserves the right to disqualify entries that violate these terms. Prize payouts are processed via Stripe and subject to their terms.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">5. API Usage</h2>
            <p>API keys are for personal or application use. Abuse, scraping beyond rate limits, or redistribution of data without permission is prohibited.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">6. Termination</h2>
            <p>We may suspend or terminate accounts that violate these terms, at our discretion and without prior notice.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">7. Limitation of Liability</h2>
            <p>myVoice is provided &ldquo;as is&rdquo; without warranties. We are not liable for any damages arising from your use of the platform.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">8. Changes</h2>
            <p>We may update these terms at any time. Continued use of the platform constitutes acceptance of updated terms.</p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
