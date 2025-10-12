async function http(path, opts={}) {
  const res = await fetch('/api' + path, {
    credentials: 'same-origin',
    ...opts
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
}

(async () => {
  const wrap = document.querySelector('#topics');
  try {
    const topics = await http('/topics'); // assumes GET /api/topics returns a list
    if (!topics.length) {
      wrap.innerHTML = '<div class="text-muted">No topics yet.</div>';
      return;
    }
    wrap.innerHTML = topics.map(t => `
      <div class="card">
        <div class="card-body">
          <h5 class="card-title mb-1"><a href="/forum/${t.Topic_ID}">${t.Title}</a></h5>
          <div class="text-muted small">Module ${t.Module_ID} • by user ${t.User_ID}</div>
          ${t.Description ? `<p class="mt-2">${t.Description}</p>` : ''}
        </div>
      </div>
    `).join('');
  } catch (e) {
    wrap.innerHTML = `<div class="text-danger">Failed to load topics: ${e.message}</div>`;
  }
})();
