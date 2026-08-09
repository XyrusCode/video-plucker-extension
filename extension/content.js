(function () {
  if (document.getElementById('video-plucker-btn')) return;

  const host = window.location.hostname.toLowerCase();
  const isVideoPage =
    host.includes('youtube.com') ||
    host.includes('youtu.be') ||
    host.includes('twitter.com') ||
    host.includes('x.com') ||
    host.includes('tiktok.com');

  if (!isVideoPage) return;

  const btn = document.createElement('button');
  btn.id = 'video-plucker-btn';
  btn.innerHTML = '🪶 Pluck';
  btn.title = 'Download this video with Video Plucker';

  btn.addEventListener('click', () => {
    const isPlaylist =
      (host.includes('youtube') &&
        (window.location.href.includes('playlist') ||
          window.location.href.includes('&list=')));

    chrome.storage.local.set(
      { pluckContextUrl: window.location.href, pluckContextIsPlaylist: isPlaylist },
      () => {
        const toast = document.createElement('div');
        toast.id = 'video-plucker-toast';
        toast.textContent = 'Ready! Click the Video Plucker extension icon.';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    );
  });

  document.body.appendChild(btn);
})();
