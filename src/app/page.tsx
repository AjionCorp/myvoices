"use client";

import { Header } from "@/components/ui/Header";
import { TopicsLanding } from "@/components/topics/TopicsLanding";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-5xl px-4 pb-16 pt-6">
        <TopicsLanding />
      </main>
    </div>
  );
}
