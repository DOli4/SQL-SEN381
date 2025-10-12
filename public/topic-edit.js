async function getTopic(id) {
  const r = await fetch(`/api/topics/${id}`, { credentials:'same-origin' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function putTopic(id, body) {
  const r = await fetch(`/api/topics/${id}`, {
    method:'PUT',
    headers:{ 'Content-Type':'application/json' },
    credentials:'same-origin',
    body: JSON.stringify(body)
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

const form = document.querySelector('#editForm');
const msg  = document.querySelector('#msg');

(async () => {
  try {
    const t = await getTopic(topicId);
    form.title.value = t.Title;
    form.moduleId.value = t.Module_ID;
    form.description.value = t.Description || '';
  } catch (e) {
    msg.className = 'text-danger';
    msg.textContent = e.message || 'Failed to load topic';
  }
})();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  const fd = new FormData(form);
  const title = (fd.get('title') || '').trim();
  const moduleId = Number(fd.get('moduleId'));
  const description = (fd.get('description') || '').trim() || null;

  try {
    await putTopic(topicId, { title, moduleId, description });
    location.href = `/forum/${topicId}`;
  } catch (e2) {
    msg.className = 'text-danger';
    msg.textContent = e2.message || 'Update failed';
  }
});
