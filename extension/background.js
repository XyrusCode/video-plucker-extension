const DESKTOP_APP_URL = 'https://github.com/XyrusCode/xyrus-yt-plucker/releases';

const SITE_PATTERNS = [
  '*://*.youtube.com/*',
  '*://*.twitter.com/*',
  '*://*.x.com/*',
  '*://*.tiktok.com/*',
];

function buildPluckerUrl(action, url, quality) {
  const params = new URLSearchParams({ url });
  if (quality) params.set('quality', quality);
  return `yt-plucker://${action}?${params}`;
}

function launchDesktopApp(action, url, quality) {
  const pluckerUrl = buildPluckerUrl(action, url, quality);
  // chrome.tabs.create with custom schemes is unreliable — use a data: URL
  // redirect so the protocol navigation is page-initiated, not API-initiated.
  const html = `<html><body><script>location.href='${pluckerUrl.replace(/'/g, "\\'")}';</script></body></html>`;
  const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);

  chrome.tabs.create({ url: dataUrl, active: false }, (tab) => {
    if (chrome.runtime.lastError) {
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'Desktop App Not Found',
        message: 'Please install Xyrus YT Plucker to download. Click for download page.',
      }, () => {
        chrome.notifications.onClicked.addListener(() => {
          chrome.tabs.create({ url: DESKTOP_APP_URL });
        });
      });
    } else {
      // Give the redirect time to fire, then clean up
      setTimeout(() => {
        chrome.tabs.remove(tab.id).catch(() => {});
      }, 2000);
    }
  });
}

// Remove stale context menus from previous versions, then re-create.
// Called at service-worker startup (not just onInstalled) so reloads pick up changes.
chrome.contextMenus.removeAll(() => {
  chrome.contextMenus.create({
    id: 'pluck-video',
    title: 'Pluck This Video',
    contexts: ['link', 'page'],
    documentUrlPatterns: SITE_PATTERNS,
  });
  chrome.contextMenus.create({
    id: 'pluck-playlist',
    title: 'Pluck This Playlist',
    contexts: ['link', 'page'],
    documentUrlPatterns: SITE_PATTERNS,
  });
});

chrome.contextMenus.onClicked.addListener((info) => {
  const url = info.linkUrl || info.pageUrl;
  chrome.storage.sync.get(['autoDownload', 'defaultQuality'], (data) => {
    if (data.autoDownload && data.defaultQuality) {
      launchDesktopApp('pluck', url, data.defaultQuality);
    } else {
      launchDesktopApp('analyze', url);
    }
  });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSettings') {
    chrome.storage.sync.get(['defaultQuality', 'autoDownload', 'cookiesFromBrowser'], (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (message.action === 'launchDesktopApp') {
    launchDesktopApp(message.mode || 'analyze', message.url, message.quality);
    return true;
  }
});
