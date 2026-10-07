import { QueryClient } from "@tanstack/react-query";

/** Local data: no network flakiness to retry, and the backend pushes changes via invalidation. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: true },
      mutations: { retry: false },
    },
  });
}
