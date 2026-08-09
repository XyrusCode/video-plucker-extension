const DEFAULT_BACKEND = 'http://localhost:8000';

const SITE_PATTERNS = [
  '*://*.youtube.com/*',
  '*://*.twitter.com/*',
  '*://*.x.com/*',
  '*://*.tiktok.com/*',
];

const UPDATE_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

chrome.runtime.onInstalled.addListener(() => {
  for (const pattern of SITE_PATTERNS) {
    chrome.contextMenus.create({
      id: 'pluck-video',
      title: 'Pluck This Video',
      contexts: ['link', 'page'],
      documentUrlPatterns: [pattern],
    });
    chrome.contextMenus.create({
      id: 'pluck-playlist',
      title: 'Pluck This Playlist',
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
  const isPlaylist =
    info.menuItemId === 'pluck-playlist' ||
    url.includes('playlist') ||
    url.includes('&list=');

  chrome.storage.sync.get(['autoDownload', 'defaultQuality', 'backendUrl', 'cookiesFromBrowser'], (data) => {
    if (data.autoDownload) {
      const backendUrl = data.backendUrl || DEFAULT_BACKEND;
      const formatId = data.defaultQuality || 'best[height<=1080]';
      const params = new URLSearchParams({ url, format_id: formatId });
      if (data.cookiesFromBrowser && data.cookiesFromBrowser !== 'none') {
        params.set('cookies_from_browser', data.cookiesFromBrowser);
      }
      const dlUrl = `${backendUrl}/api/download?${params}`;
      chrome.downloads.download({ url: dlUrl, saveAs: true });
    } else {
      chrome.storage.local.set(
        { pluckContextUrl: url, pluckContextIsPlaylist: isPlaylist },
        () => {
          chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon48.png',
            title: 'Ready to Pluck!',
            message: 'Click the Video Plucker icon to choose your quality.',
          });
        }
      );
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getBackendUrl') {
    chrome.storage.sync.get('backendUrl', (data) => {
      sendResponse({ backendUrl: data.backendUrl || DEFAULT_BACKEND });
    });
    return true;
  }

  if (message.action === 'triggerDownload') {
    chrome.storage.sync.get(['backendUrl', 'cookiesFromBrowser'], (data) => {
      const backendUrl = data.backendUrl || DEFAULT_BACKEND;
      const params = new URLSearchParams({ url: message.url, format_id: message.formatId });
      if (data.cookiesFromBrowser && data.cookiesFromBrowser !== 'none') {
        params.set('cookies_from_browser', data.cookiesFromBrowser);
      }
      const dlUrl = `${backendUrl}/api/download?${params}`;
      chrome.downloads.download({ url: dlUrl, saveAs: true });
    });
    return true;
  }

  if (message.action === 'getSettings') {
    chrome.storage.sync.get(['backendUrl', 'defaultQuality', 'autoDownload', 'cookiesFromBrowser'], (data) => {
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

// ── Self-Update Checker ──────────────────────────────────────────────

async function checkForUpdates() {
  const now = Date.now();

  try {
    // Check cooldown (once per day)
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
    // Strip leading 'v' if present
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
        message: `Video Plucker v${latestVersion} is available. Since this extension is side-loaded, download the new version from the GitHub Releases page and reload it in chrome://extensions.`,
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
    const av = aParts[i] || 0;
    const bv = bParts[i] || 0;
    if (av > bv) return 1;
    if (av < bv) return -1;
  }
  return 0;
}

// Set up periodic update checks via alarm
chrome.alarms.create('updateCheck', { periodInMinutes: 1440 }); // daily

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'updateCheck') {
    chrome.storage.sync.get('autoUpdate', (data) => {
      if (data.autoUpdate !== false) {
        checkForUpdates();
      }
    });
  }
});

// Handle notification clicks — open the release page
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
