document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('version').textContent = `v${chrome.runtime.getManifest().version}`;

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    const urlInput = document.getElementById('url-input');
    if (tab && tab.url) {
      urlInput.value = tab.url;
      urlInput.readOnly = false;
    } else {
      urlInput.value = '';
      urlInput.placeholder = 'Paste a video URL...';
      urlInput.readOnly = false;
    }
  });

  document.getElementById('send-btn').addEventListener('click', () => {
    const url = document.getElementById('url-input').value.trim();
    if (!url) return;

    const statusEl = document.getElementById('status-text');
    statusEl.textContent = 'Launching desktop app...';

    chrome.runtime.sendMessage({
      action: 'launchDesktopApp',
      mode: 'analyze',
      url: url,
    });

    setTimeout(() => window.close(), 800);
  });

  document.getElementById('url-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('send-btn').click();
  });
});
