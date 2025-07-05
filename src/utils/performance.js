// Performance monitoring utility
class PerformanceMonitor {
  constructor() {
    this.metrics = {};
    this.startTimes = {};
  }

  // Start timing an operation
  startTiming(operationName) {
    this.startTimes[operationName] = performance.now();
  }

  // End timing an operation
  endTiming(operationName) {
    if (this.startTimes[operationName]) {
      const duration = performance.now() - this.startTimes[operationName];
      this.metrics[operationName] = {
        duration: Math.round(duration),
        timestamp: new Date().toISOString()
      };
      delete this.startTimes[operationName];
      

      
      return duration;
    }
    return 0;
  }

  // Get all metrics
  getMetrics() {
    return this.metrics;
  }

  // Get specific metric
  getMetric(operationName) {
    return this.metrics[operationName];
  }

  // Clear all metrics
  clearMetrics() {
    this.metrics = {};
    this.startTimes = {};
  }

  // Measure component render time
  measureRender(componentName, renderFunction) {
    this.startTiming(`${componentName}-render`);
    const result = renderFunction();
    this.endTiming(`${componentName}-render`);
    return result;
  }

  // Measure async operation
  async measureAsync(operationName, asyncFunction) {
    this.startTiming(operationName);
    try {
      const result = await asyncFunction();
      this.endTiming(operationName);
      return result;
    } catch (error) {
      this.endTiming(operationName);
      throw error;
    }
  }

  // Log performance summary
  logSummary() {
    if (process.env.NODE_ENV === 'development') {
      console.group('🚀 Performance Summary');
      Object.entries(this.metrics).forEach(([operation, { duration, timestamp }]) => {
        console.log(`${operation}: ${duration}ms (${timestamp})`);
      });
      console.groupEnd();
    }
  }
}

// Create singleton instance
const performanceMonitor = new PerformanceMonitor();

// Export singleton and class
export { performanceMonitor };
export default PerformanceMonitor; 