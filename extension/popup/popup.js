let backendUrl = 'http://localhost:8000';
let currentPlaylistInfo = null;

const PLATFORMS = ['youtube', 'twitter', 'tiktok'];

document.addEventListener('DOMContentLoaded', () => {
  chrome.runtime.sendMessage({ action: 'getSettings' }, (res) => {
    if (res) {
      if (res.backendUrl) backendUrl = res.backendUrl;
    }
    checkBackendHealth();
    detectUrlFromContextOrTab();
    refreshCookieStatus();
  });

  checkTermsAccepted();
  checkUpdateStatus();

  document.getElementById('fetch-btn').addEventListener('click', handleFetch);
  document.getElementById('url-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleFetch();
  });
  document.getElementById('download-btn').addEventListener('click', handleDownload);
  document.getElementById('select-all').addEventListener('change', (e) => {
    document.querySelectorAll('.playlist-item input[type="checkbox"]').forEach((cb) => {
      cb.checked = e.target.checked;
    });
    updateSelectedCount();
  });

  for (const p of PLATFORMS) {
    document.getElementById(`cookie-${p}-btn`).addEventListener('click', () => importCookies(p));
    document.getElementById(`cookie-${p}-clear`).addEventListener('click', () => clearCookies(p));
  }
});

async function checkBackendHealth() {
  const dot = document.getElementById('status-dot');
  try {
    const res = await fetch(`${backendUrl}/api/health`);
    dot.className = res.ok ? 'status-online' : 'status-offline';
    dot.title = res.ok ? 'Backend connected' : 'Backend offline';
  } catch {
    dot.className = 'status-offline';
    dot.title = 'Backend offline';
  }
}

function detectUrlFromContextOrTab() {
  chrome.storage.local.get(['pluckContextUrl', 'pluckContextIsPlaylist'], (data) => {
    if (data.pluckContextUrl) {
      document.getElementById('url-input').value = data.pluckContextUrl;
      chrome.storage.local.remove(['pluckContextUrl', 'pluckContextIsPlaylist']);
      handleFetch();
    } else {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab || !tab.url) return;
        const supported = ['youtube.com', 'youtu.be', 'twitter.com', 'x.com', 'tiktok.com'];
        if (supported.some((s) => tab.url.includes(s))) {
          document.getElementById('url-input').value = tab.url;
          handleFetch();
        }
      });
    }
  });
}

function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
  document.getElementById('video-info').classList.add('hidden');
  document.getElementById('error').classList.add('hidden');
  document.getElementById('download-btn').disabled = true;
}

function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

function showError(msg) {
  document.getElementById('error').classList.remove('hidden');
  document.getElementById('error-message').textContent = msg;
  document.getElementById('video-info').classList.add('hidden');
  document.getElementById('download-btn').disabled = true;
}

async function handleFetch() {
  const url = document.getElementById('url-input').value.trim();
  if (!url) return;
  showLoading();
  try {
    const res = await fetch(`${backendUrl}/api/info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || 'Failed to fetch info');
    }
    const data = await res.json();
    hideLoading();
    if (data.type === 'playlist') showPlaylist(data);
    else showVideo(data);
  } catch (err) {
    hideLoading();
    showError(err.message);
  }
}

function prettySource(source) {
  if (!source) return '';
  const s = source.toLowerCase();
  if (s.includes('youtube')) return 'YouTube';
  if (s.includes('twitter') || s === 'x') return 'X (Twitter)';
  if (s.includes('tiktok')) return 'TikTok';
  return source;
}

function sourceColor(source) {
  const s = source.toLowerCase();
  if (s.includes('youtube')) return '#ff0000';
  if (s.includes('twitter') || s === 'x') return '#1da1f2';
  if (s.includes('tiktok')) return '#ff0050';
  return 'var(--text-secondary)';
}

function showVideo(data) {
  currentPlaylistInfo = null;
  document.getElementById('video-info').classList.remove('hidden');
  document.getElementById('playlist-section').classList.add('hidden');
  document.getElementById('download-btn').classList.remove('hidden');

  document.getElementById('video-title').textContent = data.title;
  document.getElementById('video-channel').textContent = data.channel || '';
  document.getElementById('thumbnail').src = data.thumbnail || '';
  document.getElementById('video-duration').textContent = data.duration ? formatDuration(data.duration) : '';

  const badge = document.getElementById('source-badge');
  if (data.source) {
    badge.textContent = prettySource(data.source);
    badge.style.background = sourceColor(data.source);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  const select = document.getElementById('format-select');
  select.innerHTML = '';
  data.formats.forEach((fmt) => {
    const opt = document.createElement('option');
    opt.value = fmt.format_id;
    opt.textContent = fmt.label;
    select.appendChild(opt);
  });

  document.getElementById('download-btn').disabled = false;
  document.getElementById('download-btn').innerHTML = '<span class="btn-icon">⬇</span> Pluck It!';
}

function showPlaylist(data) {
  currentPlaylistInfo = data;
  document.getElementById('video-info').classList.remove('hidden');
  document.getElementById('playlist-section').classList.remove('hidden');
  document.getElementById('download-btn').classList.remove('hidden');

  document.getElementById('video-title').textContent = data.title;
  document.getElementById('video-channel').textContent = `${data.videos.length} videos`;
  document.getElementById('thumbnail').src = data.videos[0]?.thumbnail || '';
  document.getElementById('video-duration').textContent = '';
  document.getElementById('playlist-title').textContent = data.title || 'Playlist';

  const badge = document.getElementById('source-badge');
  if (data.source) {
    badge.textContent = prettySource(data.source);
    badge.style.background = sourceColor(data.source);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }

  const list = document.getElementById('playlist-list');
  list.innerHTML = '';
  data.videos.forEach((v, i) => {
    const item = document.createElement('div');
    item.className = 'playlist-item';
    item.innerHTML = `
      <input type="checkbox" data-index="${i}" checked />
      <span class="pl-item-title">${v.title || 'Unknown'}</span>
      <span class="pl-item-dur">${v.duration ? formatDuration(v.duration) : ''}</span>
    `;
    item.querySelector('input').addEventListener('change', updateSelectedCount);
    list.appendChild(item);
  });
  updateSelectedCount();

  const select = document.getElementById('format-select');
  select.innerHTML = '';
  const commonFormats = [
    { id: 'bestvideo+bestaudio/best', label: 'Best Quality (auto)' },
    { id: 'best[height<=2160]', label: '4K (2160p)' },
    { id: 'best[height<=1080]', label: '1080p Full HD' },
    { id: 'best[height<=720]', label: '720p HD' },
    { id: 'best[height<=480]', label: '480p' },
    { id: 'best[height<=360]', label: '360p' },
    { id: 'bestaudio/best', label: 'Audio Only (best)' },
  ];
  commonFormats.forEach((f) => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.label;
    select.appendChild(opt);
  });

  document.getElementById('download-btn').disabled = false;
  document.getElementById('download-btn').innerHTML = '<span class="btn-icon">⬇</span> Pluck All Selected';
}

function updateSelectedCount() {
  const checked = document.querySelectorAll('.playlist-item input[type="checkbox"]:checked').length;
  document.getElementById('selected-count').textContent = `${checked} selected`;
}

function buildDownloadUrl(base, url, formatId) {
  return `${base}/api/download?url=${encodeURIComponent(url)}&format_id=${encodeURIComponent(formatId)}`;
}

function triggerChromeDownload(dlUrl, filename) {
  chrome.downloads.download({ url: dlUrl, filename: filename || undefined, saveAs: true });
}

async function handleDownload() {
  const url = document.getElementById('url-input').value.trim();
  const formatId = document.getElementById('format-select').value;
  const btn = document.getElementById('download-btn');
  btn.disabled = true;
  btn.innerHTML = '<span class="btn-icon">⏳</span> Plucking...';

  if (currentPlaylistInfo) {
    const selected = Array.from(document.querySelectorAll('.playlist-item input[type="checkbox"]:checked')).map(
      (cb) => parseInt(cb.dataset.index)
    );
    if (selected.length === 0) { showError('No videos selected'); btn.disabled = false; btn.innerHTML = '<span class="btn-icon">⬇</span> Pluck It!'; return; }

    const mode = document.querySelector('input[name="pl-mode"]:checked').value;
    if (mode === 'zip') {
      const indices = selected.join(',');
      const dlUrl = `${backendUrl}/api/playlist/download?url=${encodeURIComponent(url)}&format_id=${encodeURIComponent(formatId)}&mode=zip&selected_videos=${indices}`;
      triggerChromeDownload(dlUrl);
    } else {
      const videos = currentPlaylistInfo.videos.filter((_, i) => selected.includes(i));
      for (let i = 0; i < videos.length; i++) {
        showProgress(`${i + 1}/${videos.length}: ${videos[i].title}`, Math.round((i / videos.length) * 80));
        const dlUrl = buildDownloadUrl(backendUrl, videos[i].url, formatId);
        triggerChromeDownload(dlUrl);
        await new Promise((r) => setTimeout(r, 500));
      }
      showProgress('Done!', 100);
      setTimeout(hideProgress, 1500);
    }
  } else {
    const dlUrl = buildDownloadUrl(backendUrl, url, formatId);
    triggerChromeDownload(dlUrl);
  }

  setTimeout(() => {
    btn.disabled = false;
    btn.innerHTML = '<span class="btn-icon">⬇</span> Pluck It!';
    hideProgress();
  }, 2000);
}

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function showProgress(text, percent) {
  document.getElementById('progress').classList.remove('hidden');
  document.getElementById('progress-text').textContent = text || 'Downloading...';
  if (percent !== undefined) document.querySelector('.progress-fill').style.width = `${percent}%`;
}

function hideProgress() {
  document.getElementById('progress').classList.add('hidden');
  document.querySelector('.progress-fill').style.width = '0%';
}

// ── Cookie Manager ─────────────────────────────────────────────────

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
    const clearBtn = document.getElementById(`cookie-${platform}-clear`);
    if (!statusEl) continue;
    if (loaded) {
      statusEl.textContent = 'Loaded';
      statusEl.className = 'cookie-status loaded';
      clearBtn.classList.remove('hidden');
    } else {
      statusEl.textContent = 'Not loaded';
      statusEl.className = 'cookie-status not-loaded';
      clearBtn.classList.add('hidden');
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
        await refreshCookieStatus();
      } else {
        const err = await res.json();
        showError(`Cookie import failed: ${err.detail || 'unknown error'}`);
      }
    } catch (err) {
      showError(`Cookie import failed: ${err}`);
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
      await refreshCookieStatus();
    }
  } catch (err) {
    showError(`Failed to clear cookies: ${err}`);
  }
}

// ── Terms & Update ───────────────────────────────────────────────────

function checkTermsAccepted() {
  chrome.storage.local.get('terms_accepted', (data) => {
    if (!data.terms_accepted) {
      document.getElementById('terms-reminder').classList.remove('hidden');
    }
  });

  document.getElementById('terms-link').addEventListener('click', (e) => {
    e.preventDefault();
    chrome.runtime.sendMessage({ action: 'openTerms' });
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
