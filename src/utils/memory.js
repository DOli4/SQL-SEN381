// super simple in-memory store (swap to Redis later if needed)
export const chatState = new Map(); // key: userId (or anon session), value: { vars: {}, history: [] }

export function getState(userId) {
  if (!chatState.has(userId)) chatState.set(userId, { vars: {}, history: [] });
  return chatState.get(userId);
}
export function setVars(userId, patch) {
  const s = getState(userId);
  s.vars = { ...s.vars, ...patch };
}
