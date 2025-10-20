document.addEventListener('DOMContentLoaded', function() {
  const toggleSwitch = document.getElementById('toggleSwitch');
  const statusText = document.getElementById('statusText');
  const statusIndicator = document.getElementById('statusIndicator');

  chrome.storage.sync.get(['isEnabled'], function(result) {
    const isEnabled = !!result.isEnabled;
    toggleSwitch.checked = isEnabled;
    updateStatusUI(isEnabled);
  });


  toggleSwitch.addEventListener('change', function() {
    const isEnabled = this.checked;
    chrome.storage.sync.set({ isEnabled: isEnabled }, function() {
      console.log('Auto scroll durumu:', isEnabled ? 'AÇIK' : 'KAPALI');
      updateStatusUI(isEnabled);
      

      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs[0].url.includes('youtube.com')) {
          chrome.tabs.sendMessage(tabs[0].id, {action: "toggle", enabled: isEnabled});
        }
      });
    });
  });


  function updateStatusUI(isEnabled) {
    if (isEnabled) {
      statusText.textContent = 'ACTIVE';
      statusText.style.color = '#34a853';
      statusIndicator.className = 'status-indicator active';
    } else {
      statusText.textContent = 'INACTIVE';
      statusText.style.color = '#ea4335';
      statusIndicator.className = 'status-indicator inactive';
    }
  }


  document.querySelector('.github-link').addEventListener('click', function(e) {
    e.preventDefault();
    chrome.tabs.create({url: this.href});
  });
});