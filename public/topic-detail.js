async function get(path, opts = {}) {
  const res = await fetch('/api' + path, { credentials: 'same-origin', ...opts });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
}

async function post(path, body, isForm = false) {
  const res = await fetch('/api' + path, {
    method: 'POST',
    credentials: 'same-origin',
    ...(isForm ? { body } : {
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
}

async function loadTopic() {
  const t = await get(`/topics/${topicId}`);
  document.querySelector('#topic').innerHTML = `
    <div class="card"><div class="card-body">
      <h4 class="mb-1">${t.Title}</h4>
      <div class="text-muted small">Module ${t.Module_ID} • by user ${t.User_ID}</div>
      ${t.Description ? `<p class="mt-2">${t.Description}</p>` : ''}
    </div></div>`;
}

async function loadFiles() {
  const files = await get(`/topics/${topicId}/content`);
  const ul = document.querySelector('#files');
  if (!files.length) {
    ul.innerHTML = '<li class="list-group-item text-muted">No files</li>';
    return;
  }
  ul.innerHTML = files.map(f => `
    <li class="list-group-item d-flex justify-content-between align-items-center">
      <span>
        ${f.FileName || f.OriginalName || 'file'}
        ${f.MimeType ? `<span class="text-muted small">(${f.MimeType})</span>` : ''}
        ${f.SizeBytes ? `<span class="text-muted small"> • ${(f.SizeBytes/1024).toFixed(1)} KB</span>` : ''}
      </span>
      <span class="d-flex gap-2">
        <a class="btn btn-sm btn-outline-secondary" href="/api/content/${f.Content_ID}/inline" target="_blank">View</a>
        <a class="btn btn-sm btn-outline-primary" href="/api/content/${f.Content_ID}/download">Download</a>
      </span>
    </li>
  `).join('');
}

async function loadReplies() {
  const rs = await get(`/replies?topicId=${topicId}`);
  const ul = document.querySelector('#replies');
  if (!rs.length) {
    ul.innerHTML = '<li class="list-group-item text-muted">No replies</li>';
    return;
  }
  ul.innerHTML = rs.map(r => `
    <li class="list-group-item">
      <div class="fw-semibold">User ${r.User_ID}</div>
      <div>${r.Description}</div>
    </li>
  `).join('');
}

document.querySelector('#uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.querySelector('#uploadMsg');
  msg.textContent = '';
  const fd = new FormData(e.currentTarget);

  try {
    const res = await fetch(`/api/topics/${topicId}/content`, {
      method: 'POST',
      body: fd,
      credentials: 'same-origin'
    });
    if (!res.ok) throw new Error(await res.text());
    msg.className = 'text-success';
    msg.textContent = 'Uploaded.';
  } catch (err) {
    msg.className = 'text-danger';
    msg.textContent = err.message;
  }
});

document.querySelector('#replyForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.querySelector('#replyMsg');
  msg.textContent = '';
  const { description } = Object.fromEntries(new FormData(e.target).entries());
  try {
    await post('/replies', { topicId, description });
    msg.className = 'text-success'; msg.textContent = 'Reply posted.';
    e.target.reset();
    await loadReplies();
  } catch (err) {
    msg.className = 'text-danger'; msg.textContent = err.message;
  }
});

(async () => {
  await loadTopic();
  await loadFiles();
  await loadReplies();
})();
