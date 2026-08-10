let currentUrl = '';

document.addEventListener('DOMContentLoaded', () => {
  checkDesktopStatus();
  detectUrlFromTab();
  checkTermsAccepted();
  checkUpdateStatus();

  document.getElementById('send-btn').addEventListener('click', handleSendToDesktop);
  document.getElementById('url-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSendToDesktop();
  });
  document.getElementById('export-cookies-btn').addEventListener('click', handleExportCookies);

  document.getElementById('terms-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ action: 'openTerms' });
  });
});

function detectUrlFromTab() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url) return;
    const supported = ['youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'tiktok.com'];
    if (supported.some((s) => tab.url.includes(s))) {
      currentUrl = tab.url;
      document.getElementById('url-input').value = currentUrl;
    }
  });
}

// ── Desktop status ──────────────────────────────────────────────────

function checkDesktopStatus() {
  const dot = document.getElementById('desktop-dot');
  const btn = document.getElementById('send-btn');
  chrome.runtime.sendMessage({ action: 'getDesktopStatus' }, (res) => {
    if (res && res.available) {
      dot.className = 'status-online';
      dot.title = 'Desktop app connected';
      btn.disabled = false;
    } else {
      dot.className = 'status-offline';
      dot.title = 'Desktop app not connected';
      btn.disabled = false; // let them try anyway
    }
  });
}

async function handleSendToDesktop() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) return;
  const btn = document.getElementById('send-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">📤</span> Sending...';
  chrome.runtime.sendMessage({ action: 'sendToDesktop', url }, (res) => {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">📤</span> Send to Desktop App';
    if (res && res.ok) {
      const status = document.getElementById('send-status');
      status.textContent = 'Sent!';
      status.className = 'send-status success';
      setTimeout(() => { status.textContent = ''; status.className = 'send-status'; }, 3000);
    }
  });
}

// ── Cookie export ───────────────────────────────────────────────────

function handleExportCookies() {
  const url = document.getElementById('url-input').value.trim();
  const status = document.getElementById('export-status');
  if (!url) {
    status.textContent = 'Paste a video URL first.';
    status.className = 'send-status error';
    return;
  }
  status.textContent = 'Exporting…';
  status.className = 'send-status';
  chrome.runtime.sendMessage({ action: 'exportCookies', url }, (res) => {
    if (res && res.ok) {
      status.textContent = `Saved ${res.count} cookies for ${res.site} to Downloads. Import it in the desktop Cookie Manager.`;
      status.className = 'send-status success';
    } else {
      status.textContent = (res && res.error) ? res.error : 'Export failed.';
      status.className = 'send-status error';
    }
  });
}

// ── Terms & updates ─────────────────────────────────────────────────

function checkTermsAccepted() {
  chrome.storage.local.get('terms_accepted', (data) => {
    if (!data.terms_accepted) {
      document.getElementById('terms-reminder').classList.remove('hidden');
    }
  });
}

function checkUpdateStatus() {
  chrome.runtime.sendMessage({ action: 'getUpdateStatus' }, (res) => {
    if (res && res.updateAvailable) {
      document.getElementById('update-indicator').classList.remove('hidden');
      document.getElementById('update-version').textContent = res.updateVersion || '';
    }
  });

  document.getElementById('update-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.storage.local.get('updateUrl', (data) => {
      if (data.updateUrl) {
        chrome.tabs.create({ url: data.updateUrl });
      } else {
        chrome.tabs.create({ url: 'https://github.com/XyrusCode/video-plucker-extension/releases/latest' });
      }
    });
  });
}
