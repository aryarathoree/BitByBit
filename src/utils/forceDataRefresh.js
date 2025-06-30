// Force data refresh utility
export const forceDataRefresh = () => {
  // Clear localStorage
  localStorage.removeItem('bitbybit-progress');
  
  // Clear any other cached data
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith('bitbybit')) {
      localStorage.removeItem(key);
    }
  });
  
  // Force reload the page to get fresh data
  window.location.reload();
};

export const clearAllProgress = () => {
  if (confirm('This will clear ALL your progress and load the latest question database. Are you sure?')) {
    forceDataRefresh();
  }
}; 