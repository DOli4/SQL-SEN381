async function http(path, opts={}) {
  const res = await fetch('/api' + path, { credentials: 'same-origin', ...opts });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
}

async function load() {
  // load topic
  const t = await http(`/topics/${topicId}`);
  const box = document.querySelector('#topic');
  box.innerHTML = `
    <div class="card"><div class="card-body">
      <h4 class="mb-1">${t.Title}</h4>
      <div class="text-muted small">Module ${t.Module_ID} • by user ${t.User_ID}</div>
      ${t.Description ? `<p class="mt-2">${t.Description}</p>` : ''}
    </div></div>
  `;

  // load attachments (if you add an endpoint like GET /api/topics/:id/content)
  try {
    const files = await http(`/topics/${topicId}/content`); // implement optional list endpoint
    const list = document.querySelector('#files');
    if (!files.length) { list.innerHTML = '<li class="list-group-item text-muted">No files</li>'; return; }
    list.innerHTML = files.map(f => `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <span>${f.OriginalName} <span class="text-muted small">(${f.MimeType || 'file'})</span></span>
        <span class="d-flex gap-2">
          <a class="btn btn-sm btn-outline-secondary" href="/api/content/${f.Content_ID}/inline" target="_blank">View</a>
          <a class="btn btn-sm btn-outline-primary" href="/api/content/${f.Content_ID}/download">Download</a>
        </span>
      </li>
    `).join('');
  } catch { /* list endpoint optional */ }
}
load();

// upload
const upForm = document.querySelector('#uploadForm');
const upMsg  = document.querySelector('#uploadMsg');

upForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  upMsg.textContent = '';
  const fd = new FormData(upForm);
  try {
    const res = await fetch('/api/content', {
      method: 'POST',
      body: fd,
      credentials: 'same-origin'
    });
    if (!res.ok) throw new Error((await res.text()) || res.statusText);
    upMsg.className = 'text-success';
    upMsg.textContent = 'Uploaded.';
    load(); // refresh list
  } catch (err) {
    upMsg.className = 'text-danger';
    upMsg.textContent = 'Upload failed: ' + err.message;
  }
});
