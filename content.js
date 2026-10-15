let isRunning = false;
let followedCount = 0;
let targetCount = 0;
let currentStatus = '';
let currentSettings = null;

function checkForRateLimit() {
  const pageText = document.body.innerText;
  if (pageText.includes('rate limited') || pageText.includes('Rate limited') || pageText.includes('try again later')) {
    return true;
  }
  const dialogs = document.querySelectorAll('[role="dialog"]');
  for (const dialog of dialogs) {
    const text = dialog.innerText.toLowerCase();
    if (text.includes('rate limit') || text.includes('try again later') || text.includes('action blocked')) {
      return true;
    }
  }
  return false;
}

function getPageType() {
  const url = window.location.href;
  if (url.includes('/explore/people')) {
    return 'explore';
  } else if (url.includes('/following') || url.includes('/followers')) {
    return 'profile-list';
  }
  return 'unknown';
}

function findFollowButtons() {
  const buttons = [];
  const pageType = getPageType();
  
  if (pageType === 'explore') {
    document.querySelectorAll('div._ap3a._aaco._aacw._aad6._aade').forEach(div => {
      const text = div.textContent.trim();
      if (text === 'Follow') {
        const parentBtn = div.closest('button');
        if (parentBtn) {
          buttons.push(parentBtn);
        } else {
          buttons.push(div);
        }
      }
    });
    
    if (buttons.length === 0) {
      document.querySelectorAll('button').forEach(btn => {
        const text = btn.textContent.trim();
        if (text === 'Follow') {
          buttons.push(btn);
        }
      });
    }
  } else if (pageType === 'profile-list') {
    document.querySelectorAll('button._aswp._aswr._aswu._asw_._asx2').forEach(btn => {
      const text = btn.textContent.trim();
      if (text === 'Follow') {
        buttons.push(btn);
      }
    });
    
    if (buttons.length === 0) {
      document.querySelectorAll('button').forEach(btn => {
        const text = btn.textContent.trim();
        if (text === 'Follow') {
          buttons.push(btn);
        }
      });
    }
  } else {
    document.querySelectorAll('button').forEach(el => {
      const text = el.textContent.trim();
      if (text === 'Follow') {
        buttons.push(el);
      }
    });
  }
  
  return buttons;
}

function sendLog(message, isError = false) {
  chrome.runtime.sendMessage({ type: 'log', message, isError }).catch(() => {});
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'ping') {
    sendResponse({ pong: true });
  } else if (message.action === 'start') {
    startFollowing(message.settings);
    sendResponse({ success: true });
  } else if (message.action === 'stop') {
    stopFollowing();
    sendResponse({ success: true });
  } else if (message.action === 'getStatus') {
    sendResponse({
      isRunning,
      followed: followedCount,
      target: targetCount,
      status: currentStatus
    });
  }
  return true;
});

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getFollowButtons() {
  return findFollowButtons();
}

function updateStatus(status) {
  currentStatus = status;
  chrome.runtime.sendMessage({
    type: 'progress',
    followed: followedCount,
    target: targetCount,
    status: status
  }).catch(() => {});
}

async function startFollowing(settings) {
  if (isRunning) {
    return;
  }
  
  isRunning = true;
  followedCount = 0;
  currentSettings = settings;
  targetCount = getRandomInt(settings.minFollow, settings.maxFollow);
  
  sendLog(`Target set: ${targetCount} follows`);
  updateStatus(`Target: ${targetCount}`);
  
  while (isRunning && followedCount < targetCount) {
    if (checkForRateLimit()) {
      sendLog('Rate limit detected!', true);
      updateStatus('Rate Limited!');
      chrome.runtime.sendMessage({ type: 'rateLimited' }).catch(() => {});
      stopFollowing();
      return;
    }

    const buttons = getFollowButtons();
    
    if (buttons.length === 0) {
      sendLog('No Follow buttons found - scrolling...', true);
      updateStatus('Searching...');
      window.scrollBy(0, 300);
      await sleep(2000);
      continue;
    }
    
    const index = settings.randomMode ? getRandomInt(0, buttons.length - 1) : 0;
    const btn = buttons[index];
    
    btn.click();
    followedCount++;
    sendLog(`Followed ${followedCount}/${targetCount}`);
    updateStatus(`${followedCount}/${targetCount}`);
    
    await sleep(1000);
    
    if (checkForRateLimit()) {
      sendLog('Rate limit detected!', true);
      updateStatus('Rate Limited!');
      chrome.runtime.sendMessage({ type: 'rateLimited' }).catch(() => {});
      stopFollowing();
      return;
    }
    
    if (settings.minDelay > 0 || settings.maxDelay > 0) {
      const delay = getRandomInt(settings.minDelay, settings.maxDelay) * 1000;
      if (delay > 0) {
        sendLog(`Waiting ${delay/1000}s...`);
        await sleep(delay);
      }
    }
  }
  
  sendLog(`Done! Followed ${followedCount} users`);
  chrome.runtime.sendMessage({ type: 'completed' }).catch(() => {});
  isRunning = false;
}

function stopFollowing() {
  isRunning = false;
  sendLog('Stopped by user');
  chrome.runtime.sendMessage({ type: 'stopped' }).catch(() => {});
}