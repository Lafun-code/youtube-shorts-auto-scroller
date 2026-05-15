let isEnabled = false;
let currentVideo = null;
let lastPlayedSrc = null;
let retryTimeout = null;
let statusElement = null;

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
  statusElement.style.display = isEnabled ? 'flex' : 'none';
}

// Remove notification
function removeStatusIndicator() {
  if (statusElement) {
    statusElement.remove();
    statusElement = null;
  }
}

// Handle video progress natively via events instead of setInterval polling
function handleTimeUpdate() {
  if (!currentVideo || !isEnabled || currentVideo.paused || currentVideo.ended) return;

  const currentTime = currentVideo.currentTime;
  const duration = currentVideo.duration;

  // We should be extremely resilient to floating point timing inaccuracies.
  // 0.25 guarantees even slow machines catch this event right at the end.
  if (duration > 0 && (duration - currentTime <= 0.25)) {
    console.log('[Shorts Scroller] Video has ended (via timeupdate), scrolling');

    // Detach listener immediately to prevent double fires
    currentVideo.removeEventListener('timeupdate', handleTimeUpdate);
    
    handleVideoEnd();
  }
}

function handleWaiting() {
  console.log('[Shorts Scroller] Video buffering...');
}

function handlePlaying() {
  console.log('[Shorts Scroller] Video resumed playing');
}

// Start video progress tracking (simplified thanks to native events)
function startProgressTracking() {
  // We no longer need the 200ms setInterval polling loop.
  // We rely on the 'timeupdate', 'ended', 'waiting', and 'playing' native events attached to currentVideo.
}

// Stop video progress tracking
function stopProgressTracking() {
  // Intervals are entirely removed in favor of event delegation on the video element itself.
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
      currentVideo.removeEventListener('timeupdate', handleTimeUpdate);
      currentVideo.removeEventListener('waiting', handleWaiting);
      currentVideo.removeEventListener('playing', handlePlaying);
    }
    
    currentVideo = null; // Important: Clear it so the observer recognizes we need a new video
    
    stopProgressTracking();

    // METHOD 1: Click the native "Next" button in YouTube Shorts
    const nextButton = document.querySelector('#navigation-button-down button') || 
                       document.querySelector('#navigation-button-down ytd-button-renderer') ||
                       document.querySelector('ytd-button-renderer#navigation-button-down button');
    
    if (nextButton) {
      nextButton.click();
      console.log('[Shorts Scroller] Clicked native Next button');
    } else {
      // Fallback to keyboard event
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
      console.log('[Shorts Scroller] Native button not found, Keyboard event sent');
    }

    // Search for a new video
    clearTimeout(retryTimeout);
    findAndAttachToNewVideo(0);

  } catch (e) {
    console.error('[Shorts Scroller] Error:', e);
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

// Improved video finding function
function findAndAttachToNewVideo(retryCount = 0) {
  clearTimeout(retryTimeout); // PREVENT CONCURRENT LEAKS

  if (!isEnabled) {
    stopProgressTracking();
    return;
  }

  if (retryCount > 200) { // Limit retry duration (approx 20 seconds)
    console.error('[Shorts Scroller] Video not found - maximum attempts exceeded');
    
    // Last resort: try recrawling the page later if still enabled
    setTimeout(() => {
      if (isEnabled && !currentVideo) {
        console.log('[Shorts Scroller] Last resort: restarting the search');
        findAndAttachToNewVideo(0);
      }
    }, 2000);
    return;
  }

  // 1. YouTube always marks the actively playing Short wrapper with the `is-active` attribute.
  //    This is vastly more reliable than calculating bounding client rects.
  const activeContainer = document.querySelector('ytd-reel-video-renderer[is-active]');
  let newVideoElement = activeContainer ? activeContainer.querySelector('video') : null;

  // Fallback to searching all videos and checking basic visibility
  if (!newVideoElement) {
    const videos = document.querySelectorAll('video');
    for (const v of videos) {
      const rect = v.getBoundingClientRect();
      const isVisible = rect.height > 100 && rect.width > 100;
      // top >= -50 gives us leeway for animations during the "Next" scroll logic
      if (isVisible && rect.top >= -50 && rect.top < window.innerHeight) {
        newVideoElement = v;
        break;
      }
    }
  }

  // Evaluate if the newly discovered element constitutes a "fresh" video we haven't processed.
  // Because YouTube reuses DOM elements (SPAs recycle <video> tags to save memory),
  // we CANNOT compare `video !== lastVideoElement`. We MUST check if the `src` attribute changed!
  const videoSrc = newVideoElement ? (newVideoElement.src || newVideoElement.currentSrc) : null;
  const isNewSrc = videoSrc && (!lastPlayedSrc || videoSrc !== lastPlayedSrc);

  if (newVideoElement && newVideoElement.readyState >= 1 && (isNewSrc || !lastPlayedSrc)) {
    console.log('[Shorts Scroller] New video found:', newVideoElement);
    
    currentVideo = newVideoElement;
    lastPlayedSrc = videoSrc;
    
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
    currentVideo.removeEventListener('timeupdate', handleTimeUpdate);
    currentVideo.removeEventListener('waiting', handleWaiting);
    currentVideo.removeEventListener('playing', handlePlaying);
    
    currentVideo.addEventListener('ended', handleVideoEnd);
    currentVideo.addEventListener('play', handleVideoPlay);
    currentVideo.addEventListener('pause', handleVideoPause);
    currentVideo.addEventListener('timeupdate', handleTimeUpdate);
    currentVideo.addEventListener('waiting', handleWaiting);
    currentVideo.addEventListener('playing', handlePlaying);

    // If the video is already playing, start progress tracking
    if (!currentVideo.paused && !currentVideo.ended) {
      startProgressTracking();
    }
    
  } else {
    // Retry finding the newly swapped video
    const delay = retryCount < 50 ? 50 : 200; // Fast retries at first, then slow down
    retryTimeout = setTimeout(() => findAndAttachToNewVideo(retryCount + 1), delay);
  }
}

// Track page changes (for SPAs)
function observePageChanges() {
  const observer = new MutationObserver(() => {
    // If we lose currentVideo from the DOM, safely initiate a search
    if (isEnabled && (!currentVideo || !document.contains(currentVideo))) {
      console.log('[Shorts Scroller] DOM changed, searching for video again');
      stopProgressTracking();
      currentVideo = null;
      clearTimeout(retryTimeout); // FIX MEMORY LEAK
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
    
    console.log('[Shorts Scroller] Status:', isEnabled ? 'ACTIVE' : 'INACTIVE');
    
    if (isEnabled && !wasEnabled) {
      // The plugin is opened
      lastVideoElement = null;
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
      
    } else if (!isEnabled) { // Ensure cleanup if disabled OR moving away from Shorts
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
    currentVideo.removeEventListener('timeupdate', handleTimeUpdate);
    currentVideo.removeEventListener('waiting', handleWaiting);
    currentVideo.removeEventListener('playing', handlePlaying);
  }
  isEnabled = false;
  currentVideo = null;
  lastVideoElement = null;
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
    console.log('[Shorts Scroller] State has changed');
    // Only reload state if we are actually still on a Shorts page
    if (window.location.href.includes('/shorts')) {
      loadStateAndStart();
    }
  }
});

// Page visibility change
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && isEnabled && !currentVideo) {
    console.log('[Shorts Scroller] Page is visible again, searching for video');
    findAndAttachToNewVideo(0);
  }
});

// CHECK URL AND START PROPERLY FOR YOUTUBE SPA
function checkURLAndStart() {
  if (window.location.href.includes('/shorts')) {
    console.log('[Shorts Scroller] Shorts page detected');
    loadStateAndStart();
  } else {
    console.log('[Shorts Scroller] Navigated away from Shorts');
    cleanup();
  }
}

// Initialize on load and YouTube native navigation
function initialize() {
  console.log('[Shorts Scroller] Extension initialized');
  
  // Initial Check
  checkURLAndStart();

  // Listen for YouTube's custom navigation events
  window.addEventListener('yt-navigate-finish', () => {
    checkURLAndStart();
  });

  let currentlyOnShorts = window.location.href.includes('/shorts');

  // Fallback for location changes using MutationObserver on title
  const titleObserver = new MutationObserver(() => {
    // Only check if URL changed to/from shorts
    const isNowShorts = window.location.href.includes('/shorts');
    
    if (isNowShorts !== currentlyOnShorts) {
       currentlyOnShorts = isNowShorts;
       checkURLAndStart();
    }
  });
  
  const title = document.querySelector('title');
  if (title) {
    titleObserver.observe(title, { childList: true });
  }
}


// Start
initialize();