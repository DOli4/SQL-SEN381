async function http(path, body) {
  const res = await fetch('/api' + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res.json();
}

const form = document.querySelector('#topicForm');
const msg  = document.querySelector('#msg'); // optional <p id="msg"></p> under the button

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (msg) { msg.className=''; msg.textContent=''; }

  const fd = new FormData(form);
  const title = (fd.get('title') || '').trim();
  const moduleId = Number(fd.get('moduleId'));
  const description = (fd.get('description') || '').trim() || null;

  if (!title) { (msg? (msg.className='text-danger', msg.textContent='Title is required') : alert('Title is required')); return; }
  if (!moduleId) { (msg? (msg.className='text-danger', msg.textContent='Module ID is required') : alert('Module ID is required')); return; }

  try {
    const r = await http('/topics', { title, moduleId, description });
    const id = r.Topic_ID || r.id;
    if (!id) throw new Error('API did not return Topic_ID');
    location.href = `/forum/${id}`;
  } catch (err) {
    (msg? (msg.className='text-danger', msg.textContent = 'Failed: ' + err.message) : alert(err.message));
  }
});
