import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/ui/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "myVoice privacy policy.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-muted hover:text-foreground">
          &larr; Back to Canvas
        </Link>
        <h1 className="mb-2 text-3xl font-bold text-foreground">Privacy Policy</h1>
        <p className="mb-8 text-sm text-muted">Last updated: March 2026</p>

        <div className="space-y-6 text-sm leading-relaxed text-muted">
          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Information We Collect</h2>
            <p>We collect information you provide directly: display name, email, profile details. We also collect usage data: page views, feature interactions, and API requests. Authentication is handled by Clerk — we store your Clerk user ID but not your password.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">How We Use Your Information</h2>
            <p>We use your information to: provide and improve the platform, process contest prize payouts, send notifications you&apos;ve opted into, and enforce our terms of service.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Data Sharing</h2>
            <p>We do not sell your personal data. We share data with: Stripe (for payment processing), Clerk (for authentication), and as required by law. Your public profile (display name, bio, social links) is visible to all users.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Data Storage</h2>
            <p>Your data is stored in SpacetimeDB cloud infrastructure. We retain your data for as long as your account is active. You can request data deletion by contacting us.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Cookies</h2>
            <p>We use essential cookies for authentication and session management. We do not use advertising cookies.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Your Rights</h2>
            <p>You can: access your data via your profile settings, update or correct your information, request deletion of your account. Contact <a href="mailto:privacy@myvoice.app" className="text-accent hover:underline">privacy@myvoice.app</a> for data requests.</p>
          </section>

          <section>
            <h2 className="mb-2 text-lg font-semibold text-foreground">Changes</h2>
            <p>We may update this policy. We&apos;ll notify you of material changes via email or platform notification.</p>
          </section>
        </div>
      </div>
      <Footer />
    </div>
  );
}
