const DESKTOP_PAIRING_URL = 'http://localhost:19877';

let desktopAvailable = false;

const SITE_PATTERNS = [
  '*://*.youtube.com/*',
  '*://*.twitter.com/*',
  '*://*.x.com/*',
  '*://*.tiktok.com/*',
];

const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;

// ── Desktop health polling ──────────────────────────────────────────

async function checkDesktopApp() {
  try {
    const res = await fetch(`${DESKTOP_PAIRING_URL}/health`, { signal: AbortSignal.timeout(2000) });
    desktopAvailable = res.ok;
  } catch {
    desktopAvailable = false;
  }
}

checkDesktopApp();
setInterval(checkDesktopApp, 30000);

// ── Context menus ───────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  for (const pattern of SITE_PATTERNS) {
    chrome.contextMenus.create({
      id: 'send-to-desktop',
      title: 'Send to Video Plucker',
      contexts: ['link', 'page'],
      documentUrlPatterns: [pattern],
    });
  }

  chrome.contextMenus.create({
    id: 'export-cookies',
    title: 'Export cookies.txt for this site',
    contexts: ['link', 'page'],
    documentUrlPatterns: SITE_PATTERNS,
  });

  // Open Terms of Use on first install
  chrome.tabs.create({ url: chrome.runtime.getURL('terms/terms.html') });

  // Trigger initial update check
  checkForUpdates();
});

chrome.contextMenus.onClicked.addListener((info) => {
  if (info.menuItemId === 'export-cookies') {
    const url = info.linkUrl || info.pageUrl;
    exportCookiesForUrl(url).then((res) => {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: res.ok ? 'Cookies Exported' : 'Cookie Export Failed',
        message: res.ok
          ? `Saved ${res.count} cookies for ${res.site} to Downloads. Import the file in the desktop app's Cookie Manager.`
          : res.error || 'Could not export cookies.',
      });
    });
    return;
  }
  const url = info.linkUrl || info.pageUrl;
  sendToDesktop(url);
});

// ── Message handlers ────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getDesktopStatus') {
    sendResponse({ available: desktopAvailable });
    return true;
  }

  if (message.action === 'sendToDesktop') {
    sendToDesktop(message.url).then(() => sendResponse({ ok: true }));
    return true;
  }

  if (message.action === 'exportCookies') {
    exportCookiesForUrl(message.url).then(sendResponse);
    return true;
  }

  if (message.action === 'getSettings') {
    chrome.storage.sync.get(['autoUpdate'], (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (message.action === 'getUpdateStatus') {
    chrome.storage.local.get(['updateAvailable', 'updateVersion', 'updateUrl'], (data) => {
      sendResponse({
        updateAvailable: data.updateAvailable || false,
        updateVersion: data.updateVersion || null,
        updateUrl: data.updateUrl || null,
      });
    });
    return true;
  }

  if (message.action === 'openTerms') {
    chrome.tabs.create({ url: chrome.runtime.getURL('terms/terms.html') });
    return true;
  }

  if (message.action === 'checkForUpdates') {
    checkForUpdates().then((result) => {
      sendResponse(result);
    }).catch(() => {
      sendResponse({ error: 'Update check failed' });
    });
    return true;
  }
});

// ── Desktop pairing ─────────────────────────────────────────────────

function buildProtocolUrl(url) {
  const encoded = encodeURIComponent(url).replace(/'/g, '%27');
  return `yt-plucker://analyze?url=${encoded}`;
}

async function sendToDesktop(url) {
  // Chrome blocks chrome.tabs.create with custom schemes, so the protocol
  // URL is launched via a data: URL redirect (see
  // Video-Plucker-Desktop/docs/EXTENSION_DESKTOP_INTEGRATION.md).
  const protocolUrl = buildProtocolUrl(url);
  const dataUrl = `data:text/html;charset=utf-8,<script>location.href='${protocolUrl}'</script>`;
  try {
    await chrome.tabs.create({ url: dataUrl });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Sent to Desktop',
      message: 'Video sent to Video Plucker desktop app.',
    });
  } catch {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Desktop App Not Found',
      message: 'Make sure Video Plucker desktop app is installed and running.',
    });
  }
}

// ── Cookie export ───────────────────────────────────────────────────

const SITE_COOKIE_DOMAINS = {
  youtube: ['youtube.com', 'youtu.be'],
  twitter: ['twitter.com', 'x.com'],
  tiktok: ['tiktok.com'],
};

function siteForUrl(url) {
  let host;
  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
  for (const [site, domains] of Object.entries(SITE_COOKIE_DOMAINS)) {
    if (domains.some((d) => host === d || host.endsWith(`.${d}`))) return site;
  }
  return null;
}

// One Netscape cookies.txt line: domain, includeSubdomains, path, secure,
// expiry (epoch seconds, 0 = session), name, value. Values never contain
// tabs (per RFC 6265 they exclude control chars), so this round-trips
// through yt-dlp's cookiejar.
function cookieToTokenLine(c) {
  const includeSubdomains = c.domain.startsWith('.') ? 'TRUE' : 'FALSE';
  const secure = c.secure ? 'TRUE' : 'FALSE';
  const expiry = c.expirationDate ? Math.floor(c.expirationDate) : 0;
  return [c.domain, includeSubdomains, c.path, secure, expiry, c.name, c.value].join('\t');
}

async function exportCookiesForUrl(url) {
  const site = siteForUrl(url);
  if (!site) return { ok: false, error: `Unsupported site: ${url}` };

  const seen = new Set();
  const lines = [];
  for (const domain of SITE_COOKIE_DOMAINS[site]) {
    const cookies = await chrome.cookies.getAll({ domain });
    for (const c of cookies) {
      const key = `${c.domain}|${c.name}|${c.path}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(cookieToTokenLine(c));
    }
  }
  lines.sort();

  const body = [
    '# Netscape HTTP Cookie File',
    `# Exported by Video Plucker for ${site} on ${new Date().toISOString()}`,
    "# Import in the desktop app: Settings -> Cookie Manager -> Import cookies.txt",
    '',
    ...lines,
    '',
  ].join('\n');

  const blob = new Blob([body], { type: 'text/plain' });
  const blobUrl = URL.createObjectURL(blob);
  try {
    const downloadId = await chrome.downloads.download({
      url: blobUrl,
      filename: `video-plucker-${site}-cookies.txt`,
    });
    return { ok: true, site, count: lines.length, downloadId };
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
  }
}

// ── Self-update checker ─────────────────────────────────────────────

async function checkForUpdates() {
  const now = Date.now();

  try {
    const data = await chrome.storage.local.get(['lastUpdateCheck']);
    if (data.lastUpdateCheck && (now - data.lastUpdateCheck) < UPDATE_CHECK_INTERVAL_MS) {
      return { checked: false, reason: 'cooldown' };
    }

    const currentVersion = chrome.runtime.getManifest().version;
    const apiUrl = 'https://api.github.com/repos/XyrusCode/video-plucker-extension/releases/latest';

    const res = await fetch(apiUrl, { cache: 'no-store' });
    if (!res.ok) {
      await chrome.storage.local.set({ lastUpdateCheck: now });
      return { checked: true, error: `GitHub API returned ${res.status}` };
    }

    const release = await res.json();
    const tagName = release.tag_name || '';
    const latestVersion = tagName.replace(/^v/, '');
    const releaseUrl = release.html_url || 'https://github.com/XyrusCode/video-plucker-extension/releases/latest';

    await chrome.storage.local.set({ lastUpdateCheck: now });

    if (compareVersions(latestVersion, currentVersion) > 0) {
      await chrome.storage.local.set({
        updateAvailable: true,
        updateVersion: latestVersion,
        updateUrl: releaseUrl,
      });

      chrome.notifications.create('update-available', {
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Update Available',
        message: `Video Plucker v${latestVersion} is available. Download the new version from the GitHub Releases page and reload it in chrome://extensions.`,
        priority: 2,
      });

      return { checked: true, updateAvailable: true, version: latestVersion, url: releaseUrl };
    }

    return { checked: true, updateAvailable: false, currentVersion, latestVersion };
  } catch {
    await chrome.storage.local.set({ lastUpdateCheck: now });
    return { checked: true, error: 'Network error — could not reach GitHub' };
  }
}

function compareVersions(a, b) {
  const aParts = a.split('.').map(Number);
  const bParts = b.split('.').map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    if ((aParts[i] || 0) > (bParts[i] || 0)) return 1;
    if ((aParts[i] || 0) < (bParts[i] || 0)) return -1;
  }
  return 0;
}

chrome.alarms.create('updateCheck', { periodInMinutes: 1440 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateCheck') {
    chrome.storage.sync.get('autoUpdate', (data) => {
      if (data.autoUpdate !== false) {
        checkForUpdates();
      }
    });
  }
});

chrome.notifications.onClicked.addListener((notificationId) => {
  if (notificationId === 'update-available') {
    chrome.storage.local.get('updateUrl', (data) => {
      if (data.updateUrl) {
        chrome.tabs.create({ url: data.updateUrl });
      } else {
        chrome.tabs.create({ url: 'https://github.com/XyrusCode/video-plucker-extension/releases/latest' });
      }
    });
  }
});
