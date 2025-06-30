import React, { useState, useEffect, lazy, Suspense } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { saveUserProgress, loadUserProgress } from './firebase/firestore';
import ProgressBar from './components/ProgressBar';
import TopicSection from './components/TopicSection';
import Auth from './components/Auth';
import { topicData, motivationalQuotes, DATA_VERSION, getQuestionCount } from './utils/topicData';
import logo from './assets/logo.png';
import './App.css';

// Lazy load heavy components
const LeetCodeProfile = lazy(() => import('./components/LeetCodeProfile'));

function App() {
  const [topics, setTopics] = useState(() => {
    // Try to get cached data immediately for faster initial render
    const cached = localStorage.getItem('bitbybit-progress');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const cachedVersion = parsed.version || '1.0.0';
        
        // If versions don't match, use fresh data
        if (cachedVersion !== DATA_VERSION) {
          console.log(`Version mismatch: cached ${cachedVersion} vs current ${DATA_VERSION}. Using fresh data.`);
          return topicData;
        }
        
        return Array.isArray(parsed) ? parsed : parsed.topics || topicData;
      } catch {
        return topicData;
      }
    }
    return topicData;
  });
  const [currentQuote, setCurrentQuote] = useState(() => 
    motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]
  );
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showLeetCode, setShowLeetCode] = useState(false);
  const [showResetOption, setShowResetOption] = useState(false);

  // Function to merge existing progress with new topics
  const mergeProgressWithNewTopics = (savedProgress) => {
    if (!savedProgress || savedProgress.length === 0) {
      return topicData;
    }

    // Check if saved progress has version info
    const savedVersion = savedProgress.version || '1.0.0';
    
    // If versions don't match, show reset option
    if (savedVersion !== DATA_VERSION) {
      setShowResetOption(true);
    }

    // Create a map of existing progress by topic ID
    const progressMap = new Map();
    const progressData = Array.isArray(savedProgress) ? savedProgress : savedProgress.topics || [];
    
    progressData.forEach(topic => {
      const subtopicMap = new Map();
      topic.subtopics.forEach(subtopic => {
        subtopicMap.set(subtopic.id, subtopic);
      });
      progressMap.set(topic.id, { ...topic, subtopicMap });
    });

    // Merge with current topicData
    return topicData.map(currentTopic => {
      const existingTopic = progressMap.get(currentTopic.id);
      
      if (!existingTopic) {
        // This is a new topic, return as-is
        return currentTopic;
      }

      // Merge subtopics, preserving completion status for existing ones
      const mergedSubtopics = currentTopic.subtopics.map(currentSubtopic => {
        const existingSubtopic = existingTopic.subtopicMap.get(currentSubtopic.id);
        if (existingSubtopic) {
          // Preserve completion status
          return {
            ...currentSubtopic,
            completed: existingSubtopic.completed
          };
        }
        // New subtopic, return as-is
        return currentSubtopic;
      });

      return {
        ...currentTopic,
        subtopics: mergedSubtopics
      };
    });
  };

  // Function to reset progress and use latest data
  const resetProgress = () => {
    if (user) {
      // Reset Firestore data
      const progressData = {
        topics: topicData,
        version: DATA_VERSION,
        lastUpdated: new Date().toISOString()
      };
      saveUserProgress(user.uid, progressData);
      setTopics(topicData);
    } else {
      // Reset localStorage
      localStorage.removeItem('bitbybit-progress');
      setTopics(topicData);
    }
    setShowResetOption(false);
  };

  // Calculate overall progress
  const totalSubtopics = topics.reduce((total, topic) => total + topic.subtopics.length, 0);
  const completedSubtopics = topics.reduce((total, topic) => 
    total + topic.subtopics.filter(subtopic => subtopic.completed).length, 0
  );
  const overallProgress = totalSubtopics > 0 ? (completedSubtopics / totalSubtopics) * 100 : 0;

  // Handle authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      // Only set loading if we actually need to fetch data
      const needsDataLoad = user ? true : false;
      if (needsDataLoad) {
        setIsLoading(true);
      }
      
      if (user) {
        // User is signed in - load progress from Firestore
        try {
          const savedProgress = await loadUserProgress(user.uid);
          if (savedProgress) {
            setTopics(mergeProgressWithNewTopics(savedProgress));
          }
        } catch (error) {
          console.error('Error loading user progress:', error);
        }
        setIsLoading(false);
      } else {
        // User signed out - data already loaded from localStorage in useState
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);



  // Save data whenever topics change
  useEffect(() => {
    if (!isLoading) {
      if (user) {
        // Save to Firestore if user is signed in with version info
        const progressData = {
          topics: topics,
          version: DATA_VERSION,
          lastUpdated: new Date().toISOString()
        };
        saveUserProgress(user.uid, progressData);
      } else {
        // Save to localStorage if user is not signed in with version info
        const progressData = {
          topics: topics,
          version: DATA_VERSION,
          lastUpdated: new Date().toISOString()
        };
        localStorage.setItem('bitbybit-progress', JSON.stringify(progressData));
      }
    }
  }, [topics, user, isLoading]);

  const handleSubtopicToggle = (topicId, subtopicId) => {
    setTopics(prevTopics => 
      prevTopics.map(topic => 
        topic.id === topicId 
          ? {
              ...topic,
              subtopics: topic.subtopics.map(subtopic =>
                subtopic.id === subtopicId
                  ? { ...subtopic, completed: !subtopic.completed }
                  : subtopic
              )
            }
          : topic
      )
    );
  };

  const handleQuestionToggle = (topicId, subtopicId, questionIndex) => {
    setTopics(prevTopics => 
      prevTopics.map(topic => 
        topic.id === topicId 
          ? {
              ...topic,
              subtopics: topic.subtopics.map(subtopic =>
                subtopic.id === subtopicId
                  ? {
                      ...subtopic,
                      questions: subtopic.questions.map((question, index) =>
                        index === questionIndex
                          ? { ...question, completed: !question.completed }
                          : question
                      )
                    }
                  : subtopic
              )
            }
          : topic
      )
    );
  };

  if (isLoading) {
    return (
      <div className="app">
        <div className="loading-container">
          <div className="word-loader">
            <span className="word">eat</span>
            <span className="word">sleep</span>
            <span className="word">code</span>
            <span className="word">repeat</span>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="app">
      <Auth user={user} />
      <div className="container">
        <header className="header">
          <div className="logo-container">
            <img src={logo} alt="Bit By Bit Logo" className="app-logo" />
            <h1 className="app-title">Bit By Bit</h1>
          </div>
          <p className="app-subtitle">Master DSA, One Topic at a Time</p>
          <div className="question-count-display">
            <span className="question-count">
              <strong>{getQuestionCount()}</strong> LeetCode Questions
            </span>

          </div>
          {user && (
            <div className="user-welcome">
              <p>Welcome back, {user.displayName}! Your progress is synced.</p>
            </div>
          )}
          {currentQuote && (
            <div className="quote-container">
              <p className="quote-text">"{currentQuote}"</p>
            </div>
          )}
        </header>

        <ProgressBar progress={overallProgress} />

        <div className="action-buttons">
          <button 
            onClick={() => setShowLeetCode(!showLeetCode)}
            className="toggle-button"
          >
            {showLeetCode ? 'Hide LeetCode Profile' : 'Show LeetCode Profile'}
          </button>
          {showResetOption && (
            <button 
              onClick={resetProgress}
              className="reset-button"
              style={{ marginLeft: '10px', backgroundColor: '#ff6b6b', color: 'white' }}
            >
              🔄 Update to Latest Questions
            </button>
          )}
        </div>

        {showLeetCode && (
          <Suspense fallback={<div style={{ padding: '20px', textAlign: 'center', color: '#888' }}>Loading LeetCode Profile...</div>}>
            <LeetCodeProfile user={user} />
          </Suspense>
        )}

        <main className="main-content">
          <div className="topics-container">
            {topics.map(topic => (
              <TopicSection
                key={topic.id}
                topic={topic}
                onSubtopicToggle={handleSubtopicToggle}
                onQuestionToggle={handleQuestionToggle}
              />
            ))}
          </div>
        </main>

        <footer className="footer">
          <p className="footer-text">
            {user 
              ? "Your progress is automatically saved to the cloud. Sign out to use local storage."
              : "Sign in to sync your progress across devices and never lose your data."
            }
          </p>
          <p className="footer-credit">
            BitByBit By <a 
              href="https://www.linkedin.com/in/arya-rathore-0b671528a/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="footer-link"
            >
              Arya Rathore
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default App;
