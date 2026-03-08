const apiKey = process.env.OCTOBOOST_API_KEY;
const apiUrl = "https://octo-boost.com";

if (!apiKey) throw new Error("OCTOBOOST_API_KEY environment variable is required");

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<T> {
  const { method = "GET", body } = options;

  const response = await fetch(`${apiUrl}${path}`, {
    method,
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    throw new Error("Authentication failed: invalid or missing API key (401)");
  }
  if (response.status === 402) {
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    throw new Error(`Insufficient credits: ${(data as any).error ?? "payment required"} (402)`);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as Record<string, unknown>;
    const message = (data as any).error ?? response.statusText;
    throw new Error(`API error ${response.status}: ${message}`);
  }

  return response.json() as Promise<T>;
}
