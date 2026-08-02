document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('version').textContent = `v${chrome.runtime.getManifest().version}`;

  chrome.storage.sync.get(
    ['defaultQuality', 'autoDownload', 'cookiesFromBrowser'],
    (data) => {
      document.getElementById('default-quality').value =
        data.defaultQuality || 'best[height<=1080]';
      document.getElementById('auto-download').checked =
        data.autoDownload || false;
      document.getElementById('cookies-from-browser').value =
        data.cookiesFromBrowser || 'none';
    }
  );

  document.getElementById('save-btn').addEventListener('click', saveSettings);
});

function saveSettings() {
  const defaultQuality = document.getElementById('default-quality').value;
  const autoDownload = document.getElementById('auto-download').checked;
  const cookiesFromBrowser = document.getElementById('cookies-from-browser').value;

  chrome.storage.sync.set(
    { defaultQuality, autoDownload, cookiesFromBrowser },
    () => {
      const el = document.getElementById('status');
      el.textContent = 'Settings saved!';
      el.className = 'success';
      el.style.display = 'block';
      setTimeout(() => {
        el.style.display = 'none';
        el.className = '';
      }, 3000);
    }
  );
}
