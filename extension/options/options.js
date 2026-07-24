const DEFAULT_BACKEND = 'http://localhost:8000';
const PLATFORMS = ['youtube', 'twitter', 'tiktok'];
let backendUrl = DEFAULT_BACKEND;

document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.sync.get(
    ['backendUrl', 'defaultQuality', 'autoDownload', 'cookiesFromBrowser'],
    (data) => {
      backendUrl = data.backendUrl || DEFAULT_BACKEND;
      document.getElementById('backend-url').value = backendUrl;
      document.getElementById('default-quality').value =
        data.defaultQuality || 'best[height<=1080]';
      document.getElementById('auto-download').checked =
        data.autoDownload || false;
      document.getElementById('cookies-from-browser').value =
        data.cookiesFromBrowser || 'none';
    }
  );

  document.getElementById('save-btn').addEventListener('click', saveSettings);
  document.getElementById('test-connection').addEventListener('click', testConnection);

  for (const p of PLATFORMS) {
    document.getElementById(`cookie-${p}-btn`).addEventListener('click', () => importCookies(p));
    document.getElementById(`cookie-${p}-clear`).addEventListener('click', () => clearCookies(p));
  }

  refreshCookieStatus();
});

function saveSettings() {
  backendUrl = document.getElementById('backend-url').value.trim();
  const defaultQuality = document.getElementById('default-quality').value;
  const autoDownload = document.getElementById('auto-download').checked;
  const cookiesFromBrowser = document.getElementById('cookies-from-browser').value;

  chrome.storage.sync.set(
    { backendUrl, defaultQuality, autoDownload, cookiesFromBrowser },
    () => {
      showStatus('Settings saved!', 'success');
    }
  );
}

async function testConnection() {
  const url = document.getElementById('backend-url').value.trim();
  try {
    const res = await fetch(`${url}/api/health`);
    if (res.ok) {
      showStatus('Connection successful! Backend is running.', 'success');
    } else {
      showStatus('Backend responded with an error.', 'error');
    }
  } catch {
    showStatus('Could not reach backend. Make sure the server is running.', 'error');
  }
}

function showStatus(message, type) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className = type;
  setTimeout(() => {
    el.className = '';
    el.style.display = 'none';
  }, 5000);
}

async function refreshCookieStatus() {
  let status;
  try {
    const res = await fetch(`${backendUrl}/api/cookies/status`);
    status = await res.json();
  } catch {
    return;
  }
  for (const [platform, loaded] of Object.entries(status)) {
    const statusEl = document.getElementById(`cookie-${platform}-status`);
    if (!statusEl) continue;
    if (loaded) {
      statusEl.textContent = 'Loaded';
      statusEl.className = 'cookie-status loaded';
    } else {
      statusEl.textContent = 'Not loaded';
      statusEl.className = 'cookie-status not-loaded';
    }
  }
}

async function importCookies(platform) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.txt';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('platform', platform);
    formData.append('file', file);
    try {
      const res = await fetch(`${backendUrl}/api/cookies/import`, { method: 'POST', body: formData });
      if (res.ok) {
        showStatus(`${platform} cookies imported!`, 'success');
        await refreshCookieStatus();
      } else {
        const err = await res.json();
        showStatus(`Import failed: ${err.detail || 'unknown error'}`, 'error');
      }
    } catch (err) {
      showStatus(`Import failed: ${err}`, 'error');
    }
  });
  input.click();
}

async function clearCookies(platform) {
  const formData = new FormData();
  formData.append('platform', platform);
  try {
    const res = await fetch(`${backendUrl}/api/cookies/clear`, { method: 'POST', body: formData });
    if (res.ok) {
      showStatus(`${platform} cookies cleared`, 'success');
      await refreshCookieStatus();
    }
  } catch (err) {
    showStatus(`Failed to clear: ${err}`, 'error');
  }
}
