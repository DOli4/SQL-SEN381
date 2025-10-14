// public/js/api.js
async function http(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin'
  });

  if (!res.ok) {
    // <-- this is the important bit: unwrap JSON error safely
    let msg = `${res.status} ${res.statusText}`;
    try {
      const txt = await res.text();
      if (txt) {
        const j = JSON.parse(txt);
        msg = j.error || j.message || txt;
      }
    } catch (_) { /* keep msg */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  register: (data) => http('POST', '/auth/register', data),
  login:    (data) => http('POST', '/auth/login', data),
  listTopics: () => http('GET', '/topics'),
  createTopic: (data) => http('POST', '/topics', data),
};
