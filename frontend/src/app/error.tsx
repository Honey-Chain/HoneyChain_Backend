"use client";

import { useEffect } from "react";
import Link from "next/link";
import { IconAlertTriangle, IconRefresh, IconArrowLeft } from "@tabler/icons-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("HoneyChain Application Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-md rounded-2xl border border-amber-500/20 bg-amber-50/50 p-8 shadow-xs dark:border-amber-500/10 dark:bg-amber-950/20">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
          <IconAlertTriangle size={24} />
        </div>
        <h2 className="mt-4 text-lg font-bold text-ink dark:text-ink-dark">
          Something went wrong
        </h2>
        <p className="mt-1 text-xs text-black/60 dark:text-white/60">
          {error?.message || "An unexpected error occurred while loading this page."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center gap-2 rounded-xl bg-honey px-4 py-2 text-xs font-semibold text-comb transition hover:brightness-95"
          >
            <IconRefresh size={14} />
            Try again
          </button>
          <Link
            href="/farmer/hives"
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 px-4 py-2 text-xs font-medium text-ink transition hover:bg-black/5 dark:border-white/10 dark:text-ink-dark dark:hover:bg-white/5"
          >
            <IconArrowLeft size={14} />
            Back to Hives
          </Link>
        </div>
      </div>
    </div>
  );
}
