"use client";
import { Header } from "@/components/ui/Header";
import { CreateTopicForm } from "@/components/topics/CreateTopicForm";
import { Badge } from "@/components/ui/badge";

export default function CreateTopicPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="mx-auto w-full max-w-3xl px-5 pb-32 pt-8 sm:px-8 lg:px-10 lg:pb-24">
        {/* Heading */}
        <div className="mb-10">
          <Badge variant="outline" className="inline-flex rounded-full border-border bg-surface px-2.5 py-1 text-[11px] font-medium text-muted">
            Start a new community
          </Badge>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-foreground sm:text-4xl">New topic</h1>
          <p className="mt-2 text-sm text-muted sm:text-base">
            A community grid where anyone can drop in videos around a theme.
          </p>
        </div>

        <CreateTopicForm />
      </main>
    </div>
  );
}
