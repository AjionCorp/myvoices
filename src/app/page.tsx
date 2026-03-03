"use client";

import { Header } from "@/components/ui/Header";
import { LandingCanvas } from "@/components/landing/LandingCanvas";

export default function Home() {
  return (
    <div className="h-screen overflow-hidden bg-background">
      {/* Header floats above the canvas */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 40 }}>
        <Header />
      </div>
      <LandingCanvas />
    </div>
  );
}
