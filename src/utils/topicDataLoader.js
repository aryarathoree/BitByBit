// Lazy loading utility for topic data
import { useState, useCallback } from 'react';
import { performanceMonitor } from './performance';

// Chunk size for loading topics
const CHUNK_SIZE = 3;

// Cache for loaded chunks
const loadedChunks = new Map();

// Lazy load topic data in chunks
export const loadTopicChunks = async (topicData, chunkIndex = 0) => {
  performanceMonitor.startTiming(`load-chunk-${chunkIndex}`);
  
  try {
    const startIndex = chunkIndex * CHUNK_SIZE;
    const endIndex = Math.min(startIndex + CHUNK_SIZE, topicData.length);
    
    if (startIndex >= topicData.length) {
      return null;
    }
    
    const chunk = topicData.slice(startIndex, endIndex);
    
    // Simulate processing time for demonstration
    await new Promise(resolve => setTimeout(resolve, 10));
    
    loadedChunks.set(chunkIndex, chunk);
    
    performanceMonitor.endTiming(`load-chunk-${chunkIndex}`);
    
    return {
      chunk,
      chunkIndex,
      hasMore: endIndex < topicData.length,
      totalChunks: Math.ceil(topicData.length / CHUNK_SIZE)
    };
  } catch (error) {
    performanceMonitor.endTiming(`load-chunk-${chunkIndex}`);
    throw error;
  }
};

// Get all loaded chunks
export const getAllLoadedChunks = () => {
  const allChunks = [];
  for (let i = 0; i < loadedChunks.size; i++) {
    if (loadedChunks.has(i)) {
      allChunks.push(...loadedChunks.get(i));
    }
  }
  return allChunks;
};

// Check if chunk is loaded
export const isChunkLoaded = (chunkIndex) => {
  return loadedChunks.has(chunkIndex);
};

// Clear loaded chunks
export const clearLoadedChunks = () => {
  loadedChunks.clear();
};

// Preload next chunk
export const preloadNextChunk = async (topicData, currentChunkIndex) => {
  const nextChunkIndex = currentChunkIndex + 1;
  if (!isChunkLoaded(nextChunkIndex)) {
    try {
      await loadTopicChunks(topicData, nextChunkIndex);
    } catch (error) {
      console.warn('Failed to preload next chunk:', error);
    }
  }
};

// Progressive loading hook
export const useProgressiveLoading = (topicData) => {
  const [loadedTopics, setLoadedTopics] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);

  const loadNextChunk = useCallback(async () => {
    if (isLoading) return;
    
    setIsLoading(true);
    try {
      const result = await loadTopicChunks(topicData, currentChunk);
      if (result) {
        setLoadedTopics(prev => [...prev, ...result.chunk]);
        setCurrentChunk(prev => prev + 1);
        
        // Preload next chunk in background
        preloadNextChunk(topicData, result.chunkIndex);
      }
    } catch (error) {
      console.error('Error loading chunk:', error);
    } finally {
      setIsLoading(false);
    }
  }, [topicData, currentChunk, isLoading]);

  return {
    loadedTopics,
    isLoading,
    loadNextChunk,
    hasMore: currentChunk * CHUNK_SIZE < topicData.length
  };
}; 