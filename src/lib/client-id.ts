// Stable per-browser identifier for anonymous likes.
const KEY = "instabao_client_id";

export function getClientId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}
