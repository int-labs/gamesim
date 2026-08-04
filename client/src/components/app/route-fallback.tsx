import { Card } from "@/components/app/card";
import { Skeleton } from "@/components/ui/primitives";

/** Route-level suspense shell. Matches the page frame so there's no jump. */
export function RouteFallback() {
  return (
    <div>
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="min-h-[148px] space-y-4">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-5 w-32 rounded-full" />
          </Card>
        ))}
      </div>
      <Card className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-5 w-20 rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  );
}
