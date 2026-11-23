// Twenty's REST API as the app's logic functions call it: the run's API URL and a
// token from the run, one JSON request at a time. A refusal throws, naming the
// method, path and status, never the token.

export type TwentyRest = <T = { data?: Record<string, unknown> }>(
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  body?: Record<string, unknown>,
) => Promise<T>;

export function twentyRest(apiUrl: string | undefined, token: string | undefined, fetchFn: typeof fetch): TwentyRest {
  return async (method, path, body) => {
    if (!apiUrl || !token) throw new Error('no TWENTY_API_URL or app token in the run');
    const res = await fetchFn(`${apiUrl.replace(/\/+$/, '')}/rest/${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      ...(body && { body: JSON.stringify(body) }),
    });
    if (!res.ok) throw new Error(`${method} /rest/${path.split('?')[0]} answered ${res.status}`);
    return (await res.json()) as never;
  };
}
