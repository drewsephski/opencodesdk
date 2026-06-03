"use client";

export const dynamic = "force-dynamic";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center bg-[#0f0d0b] text-[#f0ece8]">
        <div className="text-center max-w-md px-6">
          <h1 className="text-2xl font-semibold tracking-tight mb-2">Something went wrong</h1>
          <p className="text-sm opacity-60 mb-6 leading-relaxed">
            An unexpected error occurred. Please try again.
          </p>
          <button
            onClick={() => reset()}
            className="rounded-xl bg-[#f59e0b] text-white px-5 py-2.5 text-sm font-medium hover:brightness-110 transition-all"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
