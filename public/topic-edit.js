async function getTopic(id) {
  const r = await fetch(`/api/topics/${id}`, { credentials:'same-origin' });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function putTopic(id, formData) {
  const r = await fetch(`/api/topics/${id}`, {
    method:'PUT',
    credentials:'same-origin',
    body: formData // Send FormData directly
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

// Handle file selection
window.handleFiles = function(event) {
  const files = Array.from(event.target.files);
  window.selectedFiles = (window.selectedFiles || []).concat(files);
  updateFilesList();
};d

// Update the list of selected files
function updateFilesList() {
  const attachedFiles = document.getElementById('attachedFiles');
  const filesList = document.querySelector('.files-list');
  
  if (window.selectedFiles && window.selectedFiles.length > 0) {
    attachedFiles.style.display = 'block';
    filesList.innerHTML = window.selectedFiles.map((file, index) => `
      <div class="file-item">
        <span>${file.name}</span>
        <button type="button" class="btn btn-sm btn-danger" onclick="removeFile(${index})">×</button>
      </div>
    `).join('');
  } else {
    attachedFiles.style.display = 'none';
    filesList.innerHTML = '';
  }
}

// Remove a file from the selection
window.removeFile = function(index) {
  window.selectedFiles.splice(index, 1);
  updateFilesList();
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  msg.textContent = '';
  const formData = new FormData(form);
  
  // Add selected files to formData
  if (window.selectedFiles) {
    window.selectedFiles.forEach(file => {
      formData.append("files", file);
    });
  }

  try {
    await putTopic(topicId, formData);
    location.href = `/forum/${topicId}`;
  } catch (e2) {
    msg.className = 'text-danger';
    msg.textContent = e2.message || 'Update failed';
  }
});
