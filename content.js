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
  btn.title = 'Send this video to Video Plucker desktop app';

  btn.addEventListener('click', () => {
    chrome.runtime.sendMessage(
      { action: 'sendToDesktop', url: window.location.href },
      () => {
        const toast = document.createElement('div');
        toast.id = 'video-plucker-toast';
        toast.textContent = 'Sent! Video Plucker desktop app is opening.';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    );
  });

  document.body.appendChild(btn);
})();
