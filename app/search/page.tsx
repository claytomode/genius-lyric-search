import { Suspense } from "react";
import Link from "next/link";
import { ResultsView } from "@/components/ResultsView";

export default function SearchPage() {
  return (
    <main className="shell">
      <header className="site-header">
        <Link href="/">Lyric Search</Link>
      </header>
      <Suspense fallback={<p className="status">Loading...</p>}>
        <ResultsView />
      </Suspense>
    </main>
  );
}
