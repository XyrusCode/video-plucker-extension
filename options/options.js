document.addEventListener('DOMContentLoaded', loadSettings);

function loadSettings() {
  chrome.storage.sync.get(['autoUpdate'], (data) => {
    document.getElementById('auto-update').checked = data.autoUpdate !== false;
  });
}

document.getElementById('auto-update').addEventListener('change', (e) => {
  chrome.storage.sync.set({ autoUpdate: e.target.checked });
  showStatus('Settings saved.');
});

document.getElementById('save-btn').addEventListener('click', () => {
  const autoUpdate = document.getElementById('auto-update').checked;
  chrome.storage.sync.set({ autoUpdate }, () => {
    showStatus('Settings saved.');
  });
});

document.getElementById('check-now-btn').addEventListener('click', () => {
  const btn = document.getElementById('check-now-btn');
  btn.disabled = true;
  btn.textContent = 'Checking...';

  chrome.runtime.sendMessage({ action: 'checkForUpdates' }, (res) => {
    btn.disabled = false;
    btn.textContent = 'Check Now';

    if (!res) {
      showStatus('No response from background worker.');
      return;
    }
    if (res.error) {
      showStatus(res.error, true);
    } else if (res.updateAvailable) {
      showStatus(`Update available: v${res.version}. Check the notification for download link.`);
    } else {
      showStatus('You are on the latest version.');
    }
  });
});

function showStatus(message, isError = false) {
  const el = document.getElementById('status');
  el.textContent = message;
  el.className = isError ? 'status error' : 'status';
  setTimeout(() => { el.textContent = ''; el.className = 'status'; }, 4000);
}
