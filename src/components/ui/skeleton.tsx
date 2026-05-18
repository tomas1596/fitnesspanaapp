import { cn } from "@/lib/utils";
import * as React from "react";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("relative isolate overflow-hidden rounded-md bg-muted", className)}
      {...props}
    >
      {/* Barra brillante tipo loading premium; omitida si el usuario pidió menos movimiento. */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 -left-full w-[60%]",
          "bg-gradient-to-r from-transparent via-foreground/[0.12] dark:via-foreground/[0.08]",
          "motion-reduce:hidden motion-safe:animate-shimmer",
          "skew-x-[-18deg]",
        )}
      />
    </div>
  );
}

export { Skeleton };
