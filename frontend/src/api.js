// Defaults to a relative path: nginx proxies it in production, Vite proxies
// it in dev (see vite.config.js). Override in frontend/.env if the API
// ever needs to be reached at an absolute URL instead.
const BASE_URL = import.meta.env.VITE_API_BASE_URL;

async function request(path, options) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  list: () => request("/todos"),
  create: (title) => request("/todos", { method: "POST", body: JSON.stringify({ title }) }),
  update: (id, changes) =>
  request(`/todos/${id}`, { method: "PATCH", body: JSON.stringify(changes) }),
  remove: (id) => request(`/todos/${id}`, { method: "DELETE" }),
};
