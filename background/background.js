// // Background service worker for monitoring
// let monitoringInterval = null;
// let resourceData = {};
// // Add at top
// let memoryHistory = [];
// const MAX_HISTORY = 20;


// // Default settings
// let settings = {
//   monitoringInterval: 5000,
//   highMemoryThreshold: 500 * 1024 * 1024,
//   mediumMemoryThreshold: 100 * 1024 * 1024,
//   autoSuspendEnabled: false,
//   autoSuspendDelay: 30 * 60 * 1000,
//   showBadge: true
// };

// // Load settings on startup
// chrome.runtime.onInstalled.addListener(async () => {
//   console.log('Performance Monitor installed');
//   await loadSettings();
//   startMonitoring();
// });

// // Load settings from storage
// async function loadSettings() {
//   try {
//     const result = await chrome.storage.sync.get('settings');
//     if (result.settings) {
//       settings.monitoringInterval = result.settings.monitoringInterval * 1000;
//       settings.highMemoryThreshold = result.settings.highMemoryThreshold * 1024 * 1024;
//       settings.mediumMemoryThreshold = result.settings.mediumMemoryThreshold * 1024 * 1024;
//       settings.autoSuspendEnabled = result.settings.autoSuspendEnabled;
//       settings.autoSuspendDelay = result.settings.autoSuspendDelay * 60 * 1000;
//       settings.showBadge = result.settings.showBadge;
//     }
//   } catch (error) {
//     console.error('Error loading settings:', error);
//   }
// }

// // Listen for settings updates
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.action === 'updateSettings') {
//     loadSettings().then(() => {
//       // Restart monitoring with new interval
//       clearInterval(monitoringInterval);
//       startMonitoring();
//       sendResponse({ success: true });
//     });
//     return true;
//   }
  
//   // ... rest of your existing message handlers ...
// });

// // In collectResourceData function, replace badge logic with:
// if (settings.showBadge) {
//   const highMemoryTabs = resourceData.tabs.filter(t => 
//     t.memory > settings.highMemoryThreshold
//   );
  
//   if (highMemoryTabs.length > 0) {
//     chrome.action.setBadgeText({ text: String(highMemoryTabs.length) });
//     chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
//   } else {
//     chrome.action.setBadgeText({ text: '' });
//   }
// } else {
//   chrome.action.setBadgeText({ text: '' });
// }

// // Start monitoring when extension loads
// chrome.runtime.onInstalled.addListener(() => {
//   console.log('Performance Monitor installed');
//   startMonitoring();
// });

// function startMonitoring() {
//   // Monitor every 5 seconds
//   monitoringInterval = setInterval(async () => {
//     await collectResourceData();
//   }, 5000);
// }

// async function collectResourceData() {
//   try {
//     // Get all tabs
//     const tabs = await chrome.tabs.query({});
    
//     // Get system memory info
//     const memoryInfo = await chrome.system.memory.getInfo();
    
//     // Get process information for each tab
//     const processes = await chrome.processes.getProcessInfo([], true);
    
//     // Store data
//     resourceData = {
//       timestamp: Date.now(),
//       systemMemory: memoryInfo,
//       tabs: [],
//       totalMemoryUsed: 0
//     };
    
//     // Process each tab
//     for (const tab of tabs) {
//       const process = Object.values(processes).find(p => 
//         p.tabs && p.tabs.includes(tab.id)
//       );
      
//       if (process) {
//         const tabData = {
//           id: tab.id,
//           title: tab.title,
//           url: tab.url,
//           favicon: tab.favIconUrl,
//           memory: process.privateMemory || 0,
//           cpu: process.cpu || 0,
//           active: tab.active,
//           discarded: tab.discarded
//         };
        
//         resourceData.tabs.push(tabData);
//         resourceData.totalMemoryUsed += tabData.memory;
//       }
//     }

//     // Store history
//     memoryHistory.push({
//       timestamp: Date.now(),
//       total: resourceData.totalMemoryUsed,
//       tabCount: resourceData.tabs.length
//     });
    
//     if (memoryHistory.length > MAX_HISTORY) {
//       memoryHistory.shift();
//     }
    
//     resourceData.history = memoryHistory;
    
//     // Save to storage for popup access
//     await chrome.storage.local.set({ resourceData });
    
//     // Check for high memory tabs and show badge
//     const highMemoryTabs = resourceData.tabs.filter(t => 
//       t.memory > 500 * 1024 * 1024 // 500MB threshold
//     );
    
//     if (highMemoryTabs.length > 0) {
//       chrome.action.setBadgeText({ text: String(highMemoryTabs.length) });
//       chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
//     } else {
//       chrome.action.setBadgeText({ text: '' });
//     }
    
//   } catch (error) {
//     console.error('Error collecting resource data:', error);
//   }
// }

// // Message handler for popup commands
// chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
//   if (message.action === 'getResourceData') {
//     chrome.storage.local.get(['resourceData'], (result) => {
//       sendResponse(result.resourceData || {});
//     });
//     return true; // Keep channel open for async response
//   }
  
//   if (message.action === 'suspendTab') {
//     chrome.tabs.discard(message.tabId).then(() => {
//       sendResponse({ success: true });
//     }).catch(error => {
//       sendResponse({ success: false, error: error.message });
//     });
//     return true;
//   }
  
//   if (message.action === 'suspendAllInactive') {
//     suspendInactiveTabs().then(count => {
//       sendResponse({ suspended: count });
//     });
//     return true;
//   }
// });

// async function suspendInactiveTabs() {
//   const tabs = await chrome.tabs.query({ active: false, discarded: false });
//   let count = 0;
  
//   for (const tab of tabs) {
//     // Don't suspend pinned tabs or tabs playing audio
//     if (!tab.pinned && !tab.audible) {
//       try {
//         await chrome.tabs.discard(tab.id);
//         count++;
//       } catch (error) {
//         console.error(`Failed to suspend tab ${tab.id}:`, error);
//       }
//     }
//   }
  
//   return count;
// }






















// background/background.js

let monitoringInterval = null;
let resourceData = {};
let memoryHistory = [];
const MAX_HISTORY = 20; // Stores up to 20 monitoring points for the chart

// Default settings (User-friendly units: seconds, minutes, MB)
let settings = {
  monitoringInterval: 5, // seconds
  highMemoryThreshold: 500, // MB
  mediumMemoryThreshold: 100, // MB
  autoSuspendEnabled: false,
  autoSuspendDelay: 30, // minutes
  showBadge: true,
  defaultSort: 'memory',
  showChart: true
};

// Internal settings converted to correct units (milliseconds, bytes)
let internalSettings = {};

// Load settings from storage and convert units
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    
    // Overwrite defaults with stored settings if they exist
    if (result.settings) {
      settings = { ...settings, ...result.settings };
    }

    // Convert stored user-friendly settings into operational, internal units
    internalSettings = {
      // Convert seconds to milliseconds
      monitoringInterval: settings.monitoringInterval * 1000,
      // Convert MB to bytes
      highMemoryThreshold: settings.highMemoryThreshold * 1024 * 1024,
      // Convert MB to bytes
      mediumMemoryThreshold: settings.mediumMemoryThreshold * 1024 * 1024,
      autoSuspendEnabled: settings.autoSuspendEnabled,
      // Convert minutes to milliseconds
      autoSuspendDelay: settings.autoSuspendDelay * 60 * 1000,
      showBadge: settings.showBadge
    };

    console.log('Settings loaded and converted:', internalSettings);
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

// Start monitoring based on current settings
function startMonitoring() {
  // Clear any existing interval
  if (monitoringInterval !== null) {
    clearInterval(monitoringInterval);
  }
  
  // Monitor using the configured internal interval (in ms)
  monitoringInterval = setInterval(async () => {
    await collectResourceData();
  }, internalSettings.monitoringInterval);
  
  console.log(`Monitoring started with interval: ${internalSettings.monitoringInterval}ms`);
}

// Load settings and start monitoring when extension is installed or updated
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Performance Monitor installed/updated');
  await loadSettings();
  startMonitoring();
});

// Listen for messages from the popup/options pages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateSettings') {
    // Load new settings, then restart monitoring
    loadSettings().then(() => {
      startMonitoring();
      sendResponse({ success: true });
    });
    return true; // Keep the message channel open for sendResponse
  }
  
  if (message.action === 'getResourceData') {
    // Send the latest cached resource data to the popup
    chrome.storage.local.get(['resourceData'], (result) => {
      sendResponse(result.resourceData || {});
    });
    return true; // Keep the message channel open
  }
  
  if (message.action === 'suspendTab') {
    // Discard (suspend) a single tab
    chrome.tabs.discard(message.tabId).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }
  
  if (message.action === 'suspendAllInactive') {
    // Suspend all inactive tabs
    suspendInactiveTabs().then(count => {
      sendResponse({ suspended: count });
    });
    return true;
  }
});


async function collectResourceData() {
  try {
    // --- FIX: Check for chrome.processes availability to prevent crashing ---
    if (typeof chrome.processes === 'undefined') {
      const tabs = await chrome.tabs.query({});
      const memoryInfo = await chrome.system.memory.getInfo();
      
      console.warn('chrome.processes API is undefined. Tab-specific memory/CPU data is unavailable. (Requires Chrome Dev/Beta or specific flags)');

      // Fallback: Populate data structure with zeros for process metrics
      resourceData = {
        timestamp: Date.now(),
        systemMemory: memoryInfo,
        tabs: tabs.map(tab => ({
          id: tab.id,
          title: tab.title,
          url: tab.url,
          favicon: tab.favIconUrl,
          active: tab.active,
          discarded: tab.discarded,
          memory: 0,
          cpu: 0
        })),
        totalMemoryUsed: 0,
        history: memoryHistory 
      };

      await chrome.storage.local.set({ resourceData });
      chrome.action.setBadgeText({ text: '🚫' }); 
      return; 
    }
    // --- END FIX ---
    
    // Get all tabs
    const tabs = await chrome.tabs.query({});
    
    // Get system memory info (Requires "system.memory" permission)
    const memoryInfo = await chrome.system.memory.getInfo();
    
    // Get process information for each tab (Requires "processes" permission)
    const processes = await chrome.processes.getProcessInfo([], true);
    
    // Initialize/reset data structure
    resourceData = {
      timestamp: Date.now(),
      systemMemory: memoryInfo,
      tabs: [],
      totalMemoryUsed: 0
    };
    
    // Process each tab
    for (const tab of tabs) {
      // Find the process associated with the current tab ID
      const process = Object.values(processes).find(p => 
        p.tabs && p.tabs.includes(tab.id)
      );
      
      if (process) {
        const tabData = {
          id: tab.id,
          title: tab.title,
          url: tab.url,
          favicon: tab.favIconUrl,
          memory: process.privateMemory || 0, // privateMemory is in bytes
          cpu: process.cpu || 0,
          active: tab.active,
          discarded: tab.discarded
        };
        
        resourceData.tabs.push(tabData);
        resourceData.totalMemoryUsed += tabData.memory;
      }
    }

    // Store and manage history
    memoryHistory.push({
      timestamp: Date.now(),
      total: resourceData.totalMemoryUsed,
      tabCount: resourceData.tabs.length
    });
    
    if (memoryHistory.length > MAX_HISTORY) {
      memoryHistory.shift();
    }
    
    resourceData.history = memoryHistory;
    
    // Save to storage for popup access
    await chrome.storage.local.set({ resourceData });
    
    // Update badge (if enabled in settings)
    if (internalSettings.showBadge) {
      const highMemoryTabs = resourceData.tabs.filter(t => 
        t.memory > internalSettings.highMemoryThreshold
      );
      
      if (highMemoryTabs.length > 0) {
        chrome.action.setBadgeText({ text: String(highMemoryTabs.length) });
        chrome.action.setBadgeBackgroundColor({ color: '#FF0000' });
      } else {
        chrome.action.setBadgeText({ text: '' });
      }
    } else {
      chrome.action.setBadgeText({ text: '' });
    }
    
  } catch (error) {
    console.error('Error during resource collection (check manifest permissions):', error);
    chrome.action.setBadgeText({ text: 'Err' });
  }
}

async function suspendInactiveTabs() {
  // Query for tabs that are NOT active and NOT already discarded
  const tabs = await chrome.tabs.query({ active: false, discarded: false });
  let count = 0;
  
  for (const tab of tabs) {
    // Do not suspend pinned, audible, or system/internal tabs (like chrome:// or about:)
    if (!tab.pinned && !tab.audible && !tab.url.startsWith('chrome://') && !tab.url.startsWith('about:')) {
      try {
        await chrome.tabs.discard(tab.id);
        count++;
      } catch (error) {
        console.error(`Failed to suspend tab ${tab.id}:`, error);
      }
    }
  }
  
  return count;
}