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

  // Open Terms of Use on first install
  chrome.tabs.create({ url: chrome.runtime.getURL('terms/terms.html') });

  // Trigger initial update check
  checkForUpdates();
});

chrome.contextMenus.onClicked.addListener((info) => {
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

async function sendToDesktop(url) {
  try {
    await fetch(`${DESKTOP_PAIRING_URL}/pair`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Sent to Desktop',
      message: 'URL sent to Video Plucker desktop app.',
    });
  } catch {
    chrome.notifications.create({
      type: 'basic',
      iconUrl: 'icons/icon48.png',
      title: 'Desktop App Not Found',
      message: 'Make sure Video Plucker desktop app is running.',
    });
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
