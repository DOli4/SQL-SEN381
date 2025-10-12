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

function canEdit(t) {
  if (!window.currentUser) return false;
  const isOwner = t.User_ID === window.currentUser.sub;
  const role = (window.currentUser.RoleName || window.currentUser.role || '').toLowerCase();
  const isAdmin = role === 'admin';
  return isOwner || isAdmin;
}

function topicCard(t) {
  return `
  <div class="card">
    <div class="card-body">
      <h5 class="card-title"><a href="/forum/${t.Topic_ID}">${t.Title}</a></h5>
      ${t.Description ? `<p class="card-text">${t.Description}</p>` : ''}
      <div class="text-muted small mb-2">Module: ${t.Module_ID ?? '—'} · by ${t.User_ID ?? '—'}</div>

      ${canEdit(t) ? `
        <div class="d-flex gap-2">
          <a class="btn btn-sm btn-outline-primary" href="/forum/${t.Topic_ID}/edit">Edit</a>
          <button class="btn btn-sm btn-outline-danger" data-del="${t.Topic_ID}">Delete</button>
        </div>` : ``}
    </div>
  </div>`;
}

// after you inject cards into the container:
container.innerHTML = topics.map(topicCard).join('');

// wire delete buttons
container.querySelectorAll('button[data-del]').forEach(btn => {
  btn.addEventListener('click', async () => {
    const id = Number(btn.dataset.del);
    if (!confirm('Delete this topic and all its attachments/replies?')) return;
    const res = await fetch(`/api/topics/${id}`, { method:'DELETE', credentials:'same-origin' });
    if (!res.ok) return alert(await res.text());
    // refresh list
    loadTopics();
  });
});

