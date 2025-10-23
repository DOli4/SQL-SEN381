// public/js/pages/register.js
import { api } from '../api.js';

const form = document.querySelector('#registerForm');
const out  = document.querySelector('#registerOutput');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  out.textContent = '';
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    const r = await api.register({
      email: data.email,
      password: data.password,
      firstName: data.firstName,
      lastName: data.lastName,
      role: data.role
    });
    out.className = 'text-success';
    out.textContent = 'Account created.';
    console.log('REGISTER OK', r);
  } catch (err) {
    out.className = 'text-danger';
    out.textContent = 'Registration failed: ' + (err?.message || 'Unknown error');
  }
});
