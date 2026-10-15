const DEFAULT = { minFollow: 15, maxFollow: 25, minDelay: 10, maxDelay: 15, randomMode: true };

document.addEventListener('DOMContentLoaded', async () => {
  const mainApp = document.getElementById('mainApp');
  
  // Main app elements
  const tabs = document.querySelectorAll('.nav-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const minFollowInput = document.getElementById('minFollow');
  const maxFollowInput = document.getElementById('maxFollow');
  const minDelayInput = document.getElementById('minDelay');
  const maxDelayInput = document.getElementById('maxDelay');
  const randomModeInput = document.getElementById('randomMode');
  const controlBtn = document.getElementById('controlBtn');
  const statusDot = document.getElementById('statusDot');
  const progressEl = document.getElementById('progress');
  const targetEl = document.getElementById('target');
  const progressRing = document.getElementById('progressRing');
  const saveBtn = document.getElementById('saveBtn');
  const delayDisplay = document.getElementById('delayDisplay');
  const modeDisplay = document.getElementById('modeDisplay');

  const inputBtns = document.querySelectorAll('.input-btn');

  initializeMainApp();

  async function initializeMainApp() {
    function updateQuickStats() {
      const minD = minDelayInput.value !== '' ? parseInt(minDelayInput.value) : DEFAULT.minDelay;
      const maxD = maxDelayInput.value !== '' ? parseInt(maxDelayInput.value) : DEFAULT.maxDelay;
      delayDisplay.textContent = `${minD}-${maxD}s`;
      modeDisplay.textContent = randomModeInput.checked ? 'Random' : 'Sequential';
    }

    function updateProgressRing(current, target) {
      if (progressRing && target > 0) {
        const circumference = 2 * Math.PI * 52;
        const progress = current / target;
        const offset = circumference - (progress * circumference);
        progressRing.style.strokeDashoffset = offset;
      }
    }

    async function saveSettings() {
      await chrome.storage.local.set({
        minFollow: parseInt(minFollowInput.value) || DEFAULT.minFollow,
        maxFollow: parseInt(maxFollowInput.value) || DEFAULT.maxFollow,
        minDelay: minDelayInput.value !== '' ? parseInt(minDelayInput.value) : DEFAULT.minDelay,
        maxDelay: maxDelayInput.value !== '' ? parseInt(maxDelayInput.value) : DEFAULT.maxDelay,
        randomMode: randomModeInput.checked
      });
      updateQuickStats();
    }

    function updateButtonState(isRunning) {
      controlBtn.classList.toggle('running', isRunning);
      if (statusDot) statusDot.className = 'status-dot ' + (isRunning ? 'running' : 'ready');
    }

    function isInstagramUrl(url) {
      return url && url.includes('instagram.com');
    }

    function isValidInstagramPage(url) {
      if (!url) return false;
      return url.includes('/explore/people') || 
             url.includes('/following') || 
             url.includes('/followers');
    }

    async function ensureContentScriptLoaded(tabId) {
      try {
        await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        return true;
      } catch (e) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content.js']
          });
          return true;
        } catch (err) {
          console.error('Failed to inject content script:', err);
          return false;
        }
      }
    }

    async function checkStatus() {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab && isValidInstagramPage(tab.url)) {
          controlBtn.disabled = false;
          await ensureContentScriptLoaded(tab.id);
          
          try {
            const response = await chrome.tabs.sendMessage(tab.id, { action: 'getStatus' });
            if (response) {
              updateButtonState(response.isRunning);
              progressEl.textContent = response.followed;
              targetEl.textContent = response.target;
              updateProgressRing(response.followed, response.target);
            } else {
              updateButtonState(false);
            }
          } catch (e) {
            updateButtonState(false);
          }
        } else if (tab && isInstagramUrl(tab.url)) {
          controlBtn.disabled = true;
          updateButtonState(false);
        } else {
          controlBtn.disabled = true;
          updateButtonState(false);
        }
      } catch (e) {
        controlBtn.disabled = true;
        updateButtonState(false);
      }
    }
    
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
      });
    });

    inputBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.target;
        const input = document.getElementById(targetId);
        let value = parseInt(input.value) || 1;
        
        if (btn.classList.contains('plus')) {
          value++;
        } else if (btn.classList.contains('minus') && value > 1) {
          value--;
        }
        
        input.value = value;
        updateQuickStats();
        saveSettings();
      });
    });

    const saved = await chrome.storage.local.get(['minFollow', 'maxFollow', 'minDelay', 'maxDelay', 'randomMode', 'isRunning', 'initialized']);
    
    if (!saved.initialized) {
      await chrome.storage.local.set({ ...DEFAULT, initialized: true });
      minFollowInput.value = DEFAULT.minFollow;
      maxFollowInput.value = DEFAULT.maxFollow;
      minDelayInput.value = DEFAULT.minDelay;
      maxDelayInput.value = DEFAULT.maxDelay;
      randomModeInput.checked = DEFAULT.randomMode;
    } else {
      minFollowInput.value = saved.minFollow || DEFAULT.minFollow;
      maxFollowInput.value = saved.maxFollow || DEFAULT.maxFollow;
      minDelayInput.value = saved.minDelay || DEFAULT.minDelay;
      maxDelayInput.value = saved.maxDelay || DEFAULT.maxDelay;
      randomModeInput.checked = saved.randomMode !== undefined ? saved.randomMode : DEFAULT.randomMode;
    }

    await chrome.storage.local.set({ isRunning: false });
    updateButtonState(false);
    updateQuickStats();
    checkStatus();

    [minFollowInput, maxFollowInput, minDelayInput, maxDelayInput].forEach(input => {
      input.addEventListener('change', () => {
        updateQuickStats();
        saveSettings();
      });
    });

    randomModeInput.addEventListener('change', () => {
      updateQuickStats();
      saveSettings();
    });

    saveBtn.addEventListener('click', async () => {
      await saveSettings();
      saveBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
        </svg>
        Saved!
      `;
      saveBtn.style.background = '#00ba7c';
      setTimeout(() => {
        saveBtn.innerHTML = `
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
          </svg>
          Save Settings
        `;
        saveBtn.style.background = '';
      }, 1500);
    });

    controlBtn.addEventListener('click', async () => {
      await saveSettings();
      
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !isValidInstagramPage(tab.url)) {
        return;
      }

      await ensureContentScriptLoaded(tab.id);

      const isRunning = controlBtn.classList.contains('running');
      
      if (isRunning) {
        chrome.tabs.sendMessage(tab.id, { action: 'stop' });
        updateButtonState(false);
        await chrome.storage.local.set({ isRunning: false });
        if (statusDot) statusDot.className = 'status-dot stopped';
      } else {
        const settings = {
          minFollow: parseInt(minFollowInput.value) || DEFAULT.minFollow,
          maxFollow: parseInt(maxFollowInput.value) || DEFAULT.maxFollow,
          minDelay: minDelayInput.value !== '' ? parseInt(minDelayInput.value) : DEFAULT.minDelay,
          maxDelay: maxDelayInput.value !== '' ? parseInt(maxDelayInput.value) : DEFAULT.maxDelay,
          randomMode: randomModeInput.checked
        };
        
        const estimatedTarget = Math.floor((settings.minFollow + settings.maxFollow) / 2);
        targetEl.textContent = estimatedTarget;
        progressEl.textContent = '0';
        
        chrome.tabs.sendMessage(tab.id, { action: 'start', settings });
        updateButtonState(true);
        await chrome.storage.local.set({ isRunning: true });
      }
    });

    const rateLimitModal = document.getElementById('rateLimitModal');
    const rateLimitYes = document.getElementById('rateLimitYes');
    const rateLimitNo = document.getElementById('rateLimitNo');
    const modalTimer = document.getElementById('modalTimer');
    let countdownInterval = null;

    function showRateLimitModal() {
      rateLimitModal.classList.add('active');
    }

    function hideRateLimitModal() {
      rateLimitModal.classList.remove('active');
      if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
      }
    }

    async function checkPendingCooldown() {
      const data = await chrome.storage.local.get(['cooldownEndTime']);
      if (data.cooldownEndTime) {
        const remaining = Math.floor((data.cooldownEndTime - Date.now()) / 1000);
        if (remaining > 0) {
          showRateLimitModal();
          startCountdownFromSeconds(remaining);
        } else {
          await chrome.storage.local.remove(['cooldownEndTime']);
          autoResumeBot();
        }
      }
    }

    async function autoResumeBot() {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && isInstagramUrl(tab.url)) {
        const settings = {
          minFollow: parseInt(minFollowInput.value) || DEFAULT.minFollow,
          maxFollow: parseInt(maxFollowInput.value) || DEFAULT.maxFollow,
          minDelay: minDelayInput.value !== '' ? parseInt(minDelayInput.value) : DEFAULT.minDelay,
          maxDelay: maxDelayInput.value !== '' ? parseInt(maxDelayInput.value) : DEFAULT.maxDelay,
          randomMode: randomModeInput.checked
        };
        chrome.tabs.sendMessage(tab.id, { action: 'start', settings });
        updateButtonState(true);
        await chrome.storage.local.set({ isRunning: true });
      }
    }

    function formatTime(seconds) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    function startCountdownFromSeconds(seconds) {
      modalTimer.textContent = formatTime(seconds);
      rateLimitYes.disabled = true;
      rateLimitYes.textContent = 'Waiting...';
      
      countdownInterval = setInterval(async () => {
        seconds--;
        modalTimer.textContent = formatTime(seconds);
        
        if (seconds <= 0) {
          clearInterval(countdownInterval);
          countdownInterval = null;
          await chrome.storage.local.remove(['cooldownEndTime']);
          hideRateLimitModal();
          autoResumeBot();
          rateLimitYes.disabled = false;
          rateLimitYes.textContent = 'Yes, Wait';
        }
      }, 1000);
    }

    async function startCountdownAndResume() {
      const endTime = Date.now() + (120 * 1000);
      await chrome.storage.local.set({ cooldownEndTime: endTime });
      startCountdownFromSeconds(120);
    }

    rateLimitYes.addEventListener('click', () => {
      startCountdownAndResume();
    });

    rateLimitNo.addEventListener('click', async () => {
      await chrome.storage.local.remove(['cooldownEndTime']);
      hideRateLimitModal();
    });

    checkPendingCooldown();

    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === 'progress') {
        progressEl.textContent = message.followed;
        targetEl.textContent = message.target;
        updateProgressRing(message.followed, message.target);
      } else if (message.type === 'completed') {
        updateButtonState(false);
        statusDot.className = 'status-dot ready';
        chrome.storage.local.set({ isRunning: false });
      } else if (message.type === 'stopped') {
        updateButtonState(false);
        statusDot.className = 'status-dot stopped';
        chrome.storage.local.set({ isRunning: false });
      } else if (message.type === 'rateLimited') {
        updateButtonState(false);
        statusDot.className = 'status-dot stopped';
        chrome.storage.local.set({ isRunning: false });
        showRateLimitModal();
      }
    });
  }
});
