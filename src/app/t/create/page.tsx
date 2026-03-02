"use client";

import Link from "next/link";
import { Header } from "@/components/ui/Header";
import { CreateTopicForm } from "@/components/topics/CreateTopicForm";

export default function CreateTopicPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto max-w-2xl px-4 pb-20 pt-6">
        {/* Back */}
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M10 12L6 8l4-4" />
          </svg>
          Back
        </Link>

        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight text-foreground">New topic</h1>
          <p className="mt-1.5 text-sm text-muted">
            A community grid where anyone can drop in videos around a theme.
          </p>
        </div>

        <CreateTopicForm />
      </main>
    </div>
  );
}
