document.addEventListener('DOMContentLoaded', () => {
  // Check if already accepted — show success immediately
  chrome.storage.local.get('terms_accepted', (data) => {
    if (data.terms_accepted) {
      document.getElementById('terms-footer').classList.add('hidden');
      document.getElementById('accepted-message').classList.remove('hidden');
    }
  });

  document.getElementById('accept-btn').addEventListener('click', () => {
    chrome.storage.local.set({ terms_accepted: true }, () => {
      document.getElementById('terms-footer').classList.add('hidden');
      document.getElementById('accepted-message').classList.remove('hidden');

      // Close the tab after a short delay so the user sees the confirmation
      setTimeout(() => {
        chrome.tabs.getCurrent((tab) => {
          if (tab) {
            chrome.tabs.remove(tab.id);
          }
        });
      }, 1200);
    });
  });
});
