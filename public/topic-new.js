async function http(path, opts={}) {
  const res = await fetch('/api' + path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
}

const form = document.querySelector('#topicForm');
const msg  = document.querySelector('#msg');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  const data = Object.fromEntries(new FormData(form).entries());
  if (!data.title?.trim()) {
    msg.className = 'text-danger'; msg.textContent = 'Title is required'; return;
  }
  try {
    const r = await http('/topics', {
      method: 'POST',
      body: JSON.stringify({
        title: data.title.trim(),
        moduleId: Number(data.moduleId),
        description: data.description?.trim() || null
      })
    });
    msg.className = 'text-success';
    msg.textContent = 'Topic saved. Redirecting…';
    location.href = `/forum/${r.Topic_ID || r.id || ''}`;
  } catch (e) {
    msg.className = 'text-danger';
    msg.textContent = 'Failed: ' + e.message;
  }
});
