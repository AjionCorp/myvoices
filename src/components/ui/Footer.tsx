import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto flex max-w-screen-2xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-[10px] font-bold text-white">
            mV
          </div>
          <span className="text-xs text-muted">&copy; {new Date().getFullYear()} myVoice</span>
        </div>
        <nav className="flex flex-wrap items-center gap-4 text-xs text-muted">
          <Link href="/about" className="hover:text-foreground">About</Link>
          <Link href="/help" className="hover:text-foreground">Help</Link>
          <Link href="/developers" className="hover:text-foreground">Developers</Link>
          <Link href="/terms" className="hover:text-foreground">Terms</Link>
          <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
