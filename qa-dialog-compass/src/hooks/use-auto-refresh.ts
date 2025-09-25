import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface AutoRefreshOptions {
  enabled: boolean;
  interval?: number; // milliseconds
  queryKeys?: string[][]; // Array of query keys to refresh
}

export function useAutoRefresh({
  enabled,
  interval = 30000, // 30 seconds default
  queryKeys = []
}: AutoRefreshOptions) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Start new interval
    intervalRef.current = setInterval(() => {
      // Refresh specific queries
      queryKeys.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });
    }, interval);

    // Cleanup on unmount
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, interval, queryClient, queryKeys]);

  return {
    refreshNow: () => {
      queryKeys.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });
    }
  };
}

// Hook specifically for QA completion refresh
export function useQACompletionRefresh() {
  const queryClient = useQueryClient();

  const refreshAfterQA = async (conversationIds: string[]) => {
    // Invalidate individual evaluations
    await Promise.all(
      conversationIds.map(id =>
        queryClient.invalidateQueries({ queryKey: ["evaluation", { conversation_id: id }] })
      )
    );

    // Invalidate evaluations list
    queryClient.invalidateQueries({ queryKey: ["evaluations"] });

    // Invalidate conversations list
    queryClient.invalidateQueries({ queryKey: ["conversations", "all"] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  };

  return { refreshAfterQA };
}
