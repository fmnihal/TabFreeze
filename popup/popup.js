// popup/popup.js

let currentData = null;
let sortBy = 'memory';
let memoryChart = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadResourceData();
  setupEventListeners();
  
  // Auto-refresh every 10 seconds
  setInterval(loadResourceData, 10000);
});

function setupEventListeners() {
  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadResourceData();
  });
  
  // Suspend all button
  document.getElementById('suspendAllBtn').addEventListener('click', async () => {
    const btn = document.getElementById('suspendAllBtn');
    btn.disabled = true;
    btn.textContent = '⏳ Suspending...';
    
    const response = await chrome.runtime.sendMessage({ 
      action: 'suspendAllInactive' 
    });
    
    btn.textContent = `✅ Suspended ${response.suspended} tabs`;
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = '💤 Suspend Inactive';
      loadResourceData(); // Reload data to update list status
    }, 2000);
  });
  
  // Sort options
  document.querySelectorAll('input[name="sort"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      sortBy = e.target.value;
      if (currentData) renderTabList(currentData);
    });
  });
}

async function loadResourceData() {
  try {
    // Request data from the background service worker
    const data = await chrome.runtime.sendMessage({ 
      action: 'getResourceData' 
    });
    
    if (data && data.tabs) {
      currentData = data;
      updateUI(data);
    }
  } catch (error) {
    console.error('Error loading resource data. Is the background worker active?', error);
    document.getElementById('tabListContainer').innerHTML = '<div class="error-state">Error fetching data. Try reloading the extension.</div>';
  }
}

function updateChart(history) {
  const ctx = document.getElementById('memoryChart').getContext('2d');
  
  const labels = history.map(h => {
    const date = new Date(h.timestamp);
    return date.toLocaleTimeString();
  });
  
  const memoryData = history.map(h => h.total / (1024 * 1024)); // Convert to MB
  
  if (memoryChart) {
    memoryChart.data.labels = labels;
    memoryChart.data.datasets[0].data = memoryData;
    memoryChart.update();
  } else {
    // Chart.js initialization
    memoryChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: 'Memory (MB)',
          data: memoryData,
          borderColor: '#667eea',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          tension: 0.4,
          fill: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return value.toFixed(0) + ' MB';
              }
            }
          }
        }
      }
    });
  }
}

function updateUI(data) {
  // Update timestamp
  document.querySelector('.last-update').textContent = 
    `Updated ${timeAgo(data.timestamp)}`;
  
  // Update system stats
  document.getElementById('totalMemory').textContent = 
    formatBytes(data.totalMemoryUsed);
  
  if (data.systemMemory) {
    const available = data.systemMemory.availableCapacity;
    document.getElementById('systemMemory').textContent = 
      formatBytes(available);
  }
  
  document.getElementById('tabCount').textContent = 
    data.tabs.length;
  
  // Render tab list
  renderTabList(data);

  updateChart(data.history || []);
}

function renderTabList(data) {
  const container = document.getElementById('tabListContainer');
  
  if (!data.tabs || data.tabs.length === 0) {
    container.innerHTML = '<div class="empty-state">No tabs found</div>';
    return;
  }
  
  // Sort tabs
  const sortedTabs = [...data.tabs].sort((a, b) => {
    if (sortBy === 'memory') {
      return b.memory - a.memory;
    } else {
      return b.cpu - a.cpu;
    }
  });
  
  // Render
  container.innerHTML = sortedTabs.map(tab => createTabItem(tab)).join('');
  
  // Add event listeners to suspend/restore buttons
  container.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const tabId = parseInt(e.target.dataset.tabId);
      suspendTab(tabId, e.target);
    });
  });
}

function createTabItem(tab) {
  const memoryClass = getMemoryClass(tab.memory);
  // Default to a local icon if no favicon is available or on error
  const favicon = tab.favicon || 'icons/icon16.png';
  const title = tab.title || 'Untitled';
  const url = tab.url ? new URL(tab.url).hostname : 'chrome-internal';
  const buttonText = tab.discarded ? 'Restore' : 'Suspend';
  
  return `
    <div class="tab-item ${memoryClass} ${tab.discarded ? 'discarded' : ''}">
      <img src="${favicon}" class="tab-favicon" onerror="this.src='icons/icon16.png'">
      <div class="tab-info">
        <div class="tab-title">${escapeHtml(title)}</div>
        <div class="tab-url">${escapeHtml(url)}</div>
      </div>
      <div class="tab-stats">
        <div class="tab-memory" style="color: ${getMemoryColor(tab.memory)}">
          ${formatBytes(tab.memory)}
        </div>
        <div class="tab-cpu">CPU: ${formatCPU(tab.cpu)}</div>
      </div>
      <div class="tab-actions">
        <button class="tab-btn" data-tab-id="${tab.id}">${buttonText}</button>
      </div>
    </div>
  `;
}

function getMemoryClass(bytes) {
  const mb = bytes / (1024 * 1024);
  // Using hardcoded values for simplicity, could be linked to settings
  if (mb > 300) return 'high-memory';
  if (mb > 100) return 'medium-memory';
  return 'low-memory';
}

async function suspendTab(tabId, button) {
  button.disabled = true;
  button.textContent = '⏳';
  
  // Note: Restore is handled automatically by the chrome.tabs.discard() API
  // if the tab is already discarded and you "re-activate" it.
  
  try {
    const response = await chrome.runtime.sendMessage({ 
      action: 'suspendTab',
      tabId: tabId
    });
    
    if (response.success) {
        // Wait briefly for Chrome to update the tab's state, then refresh data
        setTimeout(() => {
          loadResourceData();
        }, 500);
    } else {
        throw new Error(response.error || 'Unknown suspension error');
    }

  } catch (error) {
    console.error('Error suspending/restoring tab:', error);
    button.disabled = false;
    button.textContent = 'Error';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}