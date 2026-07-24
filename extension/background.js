const DEFAULT_BACKEND = 'http://localhost:8000';

const SITE_PATTERNS = [
  '*://*.youtube.com/*',
  '*://*.twitter.com/*',
  '*://*.x.com/*',
  '*://*.tiktok.com/*',
];

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
            message: 'Click the Plucker icon to choose your quality.',
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
});
