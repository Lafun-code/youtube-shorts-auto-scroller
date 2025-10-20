let isEnabled = false;
let currentVideo = null;
let lastPlayedSrc = null;
let retryTimeout = null;
let statusElement = null;
let progressCheckInterval = null;
let lastCurrentTime = 0;
let stutterCount = 0;

// Create notification element
function createStatusIndicator() {
  if (statusElement) return;
  
  statusElement = document.createElement('div');
  statusElement.id = 'auto-scroll-indicator';
  statusElement.innerHTML = `
    <div style="
      position: fixed;
      top: 80px;
      right: 20px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      font-family: 'YouTube Sans', 'Roboto', Arial, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 9999;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.3s ease;
    ">
      <div style="
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #00ff00;
        animation: pulse 2s infinite;
      "></div>
      Auto Scroll: ON
    </div>
  `;
  
  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.5; }
      100% { opacity: 1; }
    }
    
    #auto-scroll-indicator {
      animation: slideIn 0.3s ease;
    }
    
    @keyframes slideIn {
      from { transform: translateX(100px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(statusElement);
}

// Update notification
function updateStatusIndicator() {
  if (!statusElement) return;
  
  if (isEnabled) {
    statusElement.style.display = 'flex';
  } else {
    statusElement.style.display = 'none';
  }
}

// Remove notification
function removeStatusIndicator() {
  if (statusElement) {
    statusElement.remove();
    statusElement = null;
  }
}

// Start video progress tracking
function startProgressTracking() {
  if (!currentVideo || !isEnabled) return;
  
  stopProgressTracking(); // Clear previous interval
  
  lastCurrentTime = 0;
  stutterCount = 0;
  
  progressCheckInterval = setInterval(() => {
    if (!currentVideo || !isEnabled || currentVideo.paused || currentVideo.ended) {
      return;
    }
    
    const currentTime = currentVideo.currentTime;
    const duration = currentVideo.duration;
    
    // If the video is nearing its end
    if (duration - currentTime <= 0.5) {
      console.log('[Shorts Scroller] Video is nearing its end, scroll is being prepared');
      handleVideoEnd();
      return;
    }
    
    // Check if the video is stuttering (stutter detection)
    if (currentTime === lastCurrentTime && currentTime > 0) {
      stutterCount++;
      if (stutterCount > 10) { // 2 saniye boyunca takılıyorsa
        console.log('[Shorts Scroller] Video stuck, trying alternative scroll');
        handleVideoEnd();
        return;
      }
    } else {
      stutterCount = 0;
    }
    
    lastCurrentTime = currentTime;
    
  }, 200); // Check every 200ms
}

// Stop video progress tracking
function stopProgressTracking() {
  if (progressCheckInterval) {
    clearInterval(progressCheckInterval);
    progressCheckInterval = null;
  }
}

// End of video processing
function handleVideoEnd() {
  console.log('[Shorts Scroller] Video end detected');
  stopProgressTracking();
  scrollToNext();
}

// Multiple scroll methods 
function scrollToNext() {
  if (!isEnabled) return;
  console.log('[Shorts Scroller] scrollToNext() triggered.');

  try {
    if (currentVideo) {
      lastPlayedSrc = currentVideo.src || currentVideo.currentSrc;
      // Remove event listeners from current video
      currentVideo.removeEventListener('ended', handleVideoEnd);
      currentVideo.removeEventListener('play', handleVideoPlay);
      currentVideo.removeEventListener('pause', handleVideoPause);
    }
    currentVideo = null;
    stopProgressTracking();

    // METHOD 1: Keyboard event (main method)
    const keyboardEvent = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      code: 'ArrowDown',
      keyCode: 40,
      which: 40,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    
    document.dispatchEvent(keyboardEvent);
    console.log('[Shorts Scroller] Keyboard event sent');

    // METHOD 2: Find and scroll the scroll container (backup method)
    setTimeout(() => {
      if (!currentVideo) { // Hala video bulunamadıysa
        scrollUsingContainer();
      }
    }, 500);

    // Yeni videoyu ara
    clearTimeout(retryTimeout);
    findAndAttachToNewVideo(0);

  } catch (e) {
    console.error('[Shorts Scroller] Error:', e);
    // Try alternative method in case of error
    setTimeout(scrollUsingContainer, 200);
  }
}

// When the video starts playing
function handleVideoPlay() {
  console.log('[Shorts Scroller] Video playing');
  if (currentVideo && isEnabled) {
    startProgressTracking();
  }
}

// When the video is paused
function handleVideoPause() {
  console.log('[Shorts Scroller] Video paused');
  stopProgressTracking();
}

// Alternative scroll method - container-based
function scrollUsingContainer() {
  try {
    // Various possible scroll containers
    const selectors = [
      'ytd-reel-video-renderer',
      '#shorts-container',
      'ytd-shorts',
      '.reel-video-in-sequence',
      'ytd-rich-section-renderer'
    ];

    for (const selector of selectors) {
      const container = document.querySelector(selector);
      if (container) {
        container.scrollBy({ top: window.innerHeight, behavior: 'smooth' });
        console.log('[Shorts Scroller] Container scrolling has been done:', selector);
        break;
      }
    }
  } catch (e) {
    console.error('[Shorts Scroller] Container scroll error:', e);
  }
}

// Improved video finding function
function findAndAttachToNewVideo(retryCount = 0) {
  if (!isEnabled) {
    clearTimeout(retryTimeout);
    stopProgressTracking();
    return;
  }

  if (retryCount > 200) { // 20 saniye
    console.error('[Shorts Scroller] Video not found - maximum attempts exceeded');
    
    // Last resort: try recrawling the page
    setTimeout(() => {
      if (isEnabled && !currentVideo) {
        console.log('[Shorts Scroller] Last resort: restarting the search');
        findAndAttachToNewVideo(0);
      }
    }, 2000);
    return;
  }

  // More flexible video selectors
  const videoSelectors = [
    'ytd-reel-video-renderer[is-active] video.video-stream.html5-main-video',
    'ytd-reel-video-renderer video.video-stream.html5-main-video',
    'video.html5-main-video',
    'video[src]',
    '.shorts-video video'
  ];

  let newVideoElement = null;

  // Try all selectors
  for (const selector of videoSelectors) {
    const videos = document.querySelectorAll(selector);
    
    for (const video of videos) {
      // Visibility control - more flexible
      const rect = video.getBoundingClientRect();
      const isVisible = rect.height > 100 && rect.width > 100; // Minimum boyut
      const isInViewport = rect.top >= 0 && rect.top < window.innerHeight;
      
      // Video src control
      const videoSrc = video.src || video.currentSrc;
      const isNew = !lastPlayedSrc || videoSrc !== lastPlayedSrc;
      
      if (isVisible && isInViewport && isNew && video.readyState >= 1) {
        newVideoElement = video;
        break;
      }
    }
    
    if (newVideoElement) break;
  }

  if (newVideoElement) {
    console.log('[Shorts Scroller] New video found:', newVideoElement);
    
    currentVideo = newVideoElement;
    lastPlayedSrc = currentVideo.src || currentVideo.currentSrc;
    
    // Remove the loop property
    if (currentVideo.hasAttribute('loop')) {
      currentVideo.removeAttribute('loop');
      console.log('[Shorts Scroller] Loop removed');
    }
    
    if (currentVideo.loop) {
      currentVideo.loop = false;
    }
    
    // Manage event listeners
    currentVideo.removeEventListener('ended', handleVideoEnd);
    currentVideo.removeEventListener('play', handleVideoPlay);
    currentVideo.removeEventListener('pause', handleVideoPause);
    
    currentVideo.addEventListener('ended', handleVideoEnd);
    currentVideo.addEventListener('play', handleVideoPlay);
    currentVideo.addEventListener('pause', handleVideoPause);
    
    // If the video is already playing, start progress tracking
    if (!currentVideo.paused && !currentVideo.ended) {
      startProgressTracking();
    }
    
    // If the video is already finished, scroll immediately
    if (currentVideo.ended || (currentVideo.duration && currentVideo.currentTime >= currentVideo.duration - 0.5)) {
      console.log('[Shorts Scroller] The video is already finished, scrolling');
      setTimeout(handleVideoEnd, 100);
    }
    
  } else {
    // Smarter retry mechanism
    const delay = retryCount < 50 ? 100 : 200;
    retryTimeout = setTimeout(() => findAndAttachToNewVideo(retryCount + 1), delay);
  }
}

// Track page changes (for SPAs)
function observePageChanges() {
  const observer = new MutationObserver(() => {
    if (isEnabled && (!currentVideo || !document.contains(currentVideo))) {
      console.log('[Shorts Scroller] Page changed, searching for video again');
      stopProgressTracking();
      currentVideo = null;
      findAndAttachToNewVideo(0);
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['is-active', 'src']
  });

  return observer;
}

let pageObserver = null;

// Improved state management
function loadStateAndStart() {
  chrome.storage.sync.get(['isEnabled'], function(result) {
    const wasEnabled = isEnabled;
    isEnabled = !!result.isEnabled;
    
    console.log('[Shorts Scroller] Status:', isEnabled ? 'ACTIVE' : 'PASSIVE');
    
    if (isEnabled && !wasEnabled) {
      // The plugin is opened
      lastPlayedSrc = null;
      currentVideo = null;
      clearTimeout(retryTimeout);
      stopProgressTracking();
      
      // Show notification
      createStatusIndicator();
      updateStatusIndicator();
      
      // Start tracking page changes
      if (!pageObserver) {
        pageObserver = observePageChanges();
      }
      
      findAndAttachToNewVideo(0);
      
    } else if (!isEnabled && wasEnabled) {
      // Plugin closed
      cleanup();
    }
  });
}

// Cleaning function
function cleanup() {
  if (currentVideo) {
    currentVideo.removeEventListener('ended', handleVideoEnd);
    currentVideo.removeEventListener('play', handleVideoPlay);
    currentVideo.removeEventListener('pause', handleVideoPause);
  }
  currentVideo = null;
  lastPlayedSrc = null;
  clearTimeout(retryTimeout);
  stopProgressTracking();
  
  // Remove notification
  removeStatusIndicator();
  
  if (pageObserver) {
    pageObserver.disconnect();
    pageObserver = null;
  }
}

// Event listener's
chrome.storage.onChanged.addListener(function(changes) {
  if (changes.isEnabled) {
    console.log('[Shorts Scroller] The situation has changed');
    loadStateAndStart();
  }
});

// Page visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isEnabled && !currentVideo) {
    console.log('[Shorts Scroller] Page is visible again, searching for video');
    findAndAttachToNewVideo(0);
  }
});

// Check when the page loads or updates
function initialize() {
  console.log('[Shorts Scroller] Improved version uploaded');
  
  // If we are on the YouTube Shorts page, launch it
  if (window.location.href.includes('/shorts') || document.querySelector('ytd-reel-video-renderer')) {
    loadStateAndStart();
  } else {
    // Listen when you go to the Shorts page
    const urlObserver = new MutationObserver(() => {
      if (window.location.href.includes('/shorts') || document.querySelector('ytd-reel-video-renderer')) {
        console.log('[Shorts Scroller] Shorts page detected');
        loadStateAndStart();
        urlObserver.disconnect();
      }
    });
    
    urlObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
  }
}

// Start
initialize();