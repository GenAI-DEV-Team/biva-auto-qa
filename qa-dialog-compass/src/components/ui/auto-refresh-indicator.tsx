import { useState, useEffect } from "react";
import { RefreshCw, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutoRefreshIndicatorProps {
  isRefreshing: boolean;
  lastUpdate?: Date;
  className?: string;
}

export function AutoRefreshIndicator({
  isRefreshing,
  lastUpdate,
  className
}: AutoRefreshIndicatorProps) {
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (!isRefreshing && lastUpdate) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isRefreshing, lastUpdate]);

  if (!isRefreshing && !showSuccess) {
    return null;
  }

  return (
    <div className={cn(
      "flex items-center gap-2 text-sm text-muted-foreground",
      className
    )}>
      {showSuccess ? (
        <>
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span>Updated</span>
        </>
      ) : (
        <>
          <RefreshCw className={cn(
            "h-4 w-4",
            isRefreshing ? "animate-spin" : ""
          )} />
          <span>Refreshing...</span>
        </>
      )}
    </div>
  );
}
