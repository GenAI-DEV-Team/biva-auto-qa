export function getApiBaseUrl(): string {
  // Prefer VITE_API_BASE_URL; fallback to same-origin
  const base = import.meta.env.VITE_API_BASE_URL as string | undefined;
  if (base && typeof base === "string" && base.trim().length > 0) {
    return base.replace(/\/$/, "");
  }
  return ""; // same-origin
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBaseUrl();
  const url = `${base}${path}`;
  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(init && init.headers ? init.headers : {}),
    },
    ...init,
  });
  if (!res.ok) {
    // attempt to parse json error
    let message = `${res.status} ${res.statusText}`;
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}


