"use client";

import { Button } from "@/components/ui/Button";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-[720px] px-4 py-8 md:py-16">
      <div className="flex flex-col gap-4">
        <div className="border border-danger/50 bg-danger/5 px-4 py-3 text-sm"><h2 className="font-semibold text-danger">This page could not load</h2>
          The server returned an error while loading this view. Your data was not changed.
        </div>
        <p className="text-sm text-muted">
          Try again. If the problem persists, check that the API is running and that your session is still valid.
        </p>
        <div><Button variant="primary" onClick={reset}>Try again</Button></div>
      </div>
    </div>
  );
}
