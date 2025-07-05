import React, { useState, useEffect, lazy, Suspense, useMemo, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase/config';
import { saveUserProgress, loadUserProgress, updateTopicProgress, updateQuestionProgress } from './firebase/firestore';
import ProgressBar from './components/ProgressBar';
import TopicSection from './components/TopicSection';
import Auth from './components/Auth';
import Toast from './components/Toast';
import { topicData, motivationalQuotes, DATA_VERSION, getQuestionCount } from './utils/topicData';
import { performanceMonitor } from './utils/performance';
import logo from './assets/logo.png';
import './App.css';


const LeetCodeProfile = lazy(() => import('./components/LeetCodeProfile'));

function App() {
  const [topics, setTopics] = useState(() => {

    const cached = localStorage.getItem('bitbybit-progress');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const cachedVersion = parsed.version || '1.0.0';
        

                  if (cachedVersion !== DATA_VERSION) {
            return topicData;
        }
        
        return Array.isArray(parsed) ? parsed : parsed.topics || topicData;
      } catch {
        return topicData;
      }
    }
    return topicData;
  });
  
  const [currentQuote] = useState(() => 
    motivationalQuotes[Math.floor(Math.random() * motivationalQuotes.length)]
  );
  const [user, setUser] = useState(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isDataSyncing, setIsDataSyncing] = useState(false);
  const [hasMinDisplayTimePassed, setHasMinDisplayTimePassed] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [showLeetCode, setShowLeetCode] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'info', isVisible: false });


  const progressStats = useMemo(() => {
    if (!Array.isArray(topics)) return { totalSubtopics: 0, completedSubtopics: 0, overallProgress: 0 };
    
    const totalSubtopics = topics.reduce((total, topic) => {
      return total + (Array.isArray(topic.subtopics) ? topic.subtopics.length : 0);
    }, 0);
    
    const completedSubtopics = topics.reduce((total, topic) => {
      if (!Array.isArray(topic.subtopics)) return total;
      return total + topic.subtopics.filter(subtopic => subtopic && subtopic.completed).length;
    }, 0);
    
    const overallProgress = totalSubtopics > 0 ? (completedSubtopics / totalSubtopics) * 100 : 0;
    
    return { totalSubtopics, completedSubtopics, overallProgress };
  }, [topics]);


  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, isVisible: true });
  }, []);


  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, isVisible: false }));
  }, []);


  const mergeProgressWithNewTopics = useCallback((savedProgress) => {
    if (!savedProgress || savedProgress.length === 0) {
      return topicData;
    }


    const savedVersion = savedProgress.version || '1.0.0';
    
    
    if (savedVersion !== DATA_VERSION) {

    }


    const progressMap = new Map();
    const progressData = Array.isArray(savedProgress) ? savedProgress : savedProgress.topics || [];
    

          if (!Array.isArray(progressData)) {
        return topicData;
      }
    

    progressData.forEach(topic => {
      if (topic && typeof topic === 'object' && topic.id) {
        const subtopicMap = new Map();
        if (Array.isArray(topic.subtopics)) {
          topic.subtopics.forEach(subtopic => {
            if (subtopic && subtopic.id) {
              subtopicMap.set(subtopic.id, subtopic);
            }
          });
        }
        progressMap.set(topic.id, { ...topic, subtopicMap });
      }
    });


    return topicData.map(currentTopic => {
      const existingTopic = progressMap.get(currentTopic.id);
      
      if (!existingTopic) {
        return currentTopic;
      }


      const mergedSubtopics = Array.isArray(currentTopic.subtopics) ? 
        currentTopic.subtopics.map(currentSubtopic => {
          const existingSubtopic = existingTopic.subtopicMap.get(currentSubtopic.id);
          if (existingSubtopic) {
            return {
              ...currentSubtopic,
              completed: existingSubtopic.completed,
              questions: Array.isArray(currentSubtopic.questions) ? 
                currentSubtopic.questions.map((currentQuestion, index) => {
                  const existingQuestion = existingSubtopic.questions?.[index];
                  return existingQuestion ? 
                    { ...currentQuestion, completed: existingQuestion.completed } : 
                    currentQuestion;
                }) : []
            };
          }
          return currentSubtopic;
        }) : [];

      return {
        ...currentTopic,
        subtopics: mergedSubtopics
      };
    });
  }, []);




  useEffect(() => {
    const minDisplayTimer = setTimeout(() => {
      setHasMinDisplayTimePassed(true);
    }, 2000);

    return () => clearTimeout(minDisplayTimer);
  }, []);


  useEffect(() => {
    performanceMonitor.startTiming('app-initialization');
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {

        setIsDataSyncing(true);
        
        try {

          const savedProgress = await performanceMonitor.measureAsync(
            'firestore-load-progress',
            () => loadUserProgress(user.uid)
          );
          
          if (savedProgress) {
            performanceMonitor.startTiming('merge-progress');
            setTopics(mergeProgressWithNewTopics(savedProgress));
            performanceMonitor.endTiming('merge-progress');
          }
        } catch (error) {
          console.error('Error loading user progress:', error);
        } finally {
          setIsDataSyncing(false);
        }
      }
      

      setAuthReady(true);
    });

    return () => unsubscribe();
  }, [mergeProgressWithNewTopics, showToast]);


  useEffect(() => {
    if (hasMinDisplayTimePassed && authReady) {
      setIsInitialLoad(false);
      performanceMonitor.endTiming('app-initialization');
    }
  }, [hasMinDisplayTimePassed, authReady]);




  useEffect(() => {
    if (!isInitialLoad && !isDataSyncing) {
      const timeoutId = setTimeout(() => {
        if (user) {
          const progressData = {
            topics: topics,
            version: DATA_VERSION,
            lastUpdated: new Date().toISOString()
          };
          saveUserProgress(user.uid, progressData);
        } else {
          const progressData = {
            topics: topics,
            version: DATA_VERSION,
            lastUpdated: new Date().toISOString()
          };
          localStorage.setItem('bitbybit-progress', JSON.stringify(progressData));
        }
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [topics, user, isInitialLoad, isDataSyncing]);


  const handleSubtopicToggle = useCallback((topicId, subtopicId) => {
    performanceMonitor.startTiming('subtopic-toggle');
    
    setTopics(prevTopics => {
      const updatedTopics = prevTopics.map(topic => 
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
      );
      
      if (user) {
        const updatedSubtopic = updatedTopics
          .find(t => t.id === topicId)
          ?.subtopics.find(s => s.id === subtopicId);
        if (updatedSubtopic) {
          setIsSaving(true);
          performanceMonitor.measureAsync(
            'firestore-update-subtopic',
            () => updateTopicProgress(user.uid, topicId, subtopicId, updatedSubtopic.completed)
          ).then(() => {
            setIsSaving(false);
          }).catch(error => {
            console.error('Error updating subtopic progress:', error);
            setIsSaving(false);
            showToast('Failed to save progress. Please try again.', 'error');
          });
        }
      }
      
      performanceMonitor.endTiming('subtopic-toggle');
      return updatedTopics;
    });
  }, [user, showToast]);

  const handleQuestionToggle = useCallback((topicId, subtopicId, questionIndex) => {
    performanceMonitor.startTiming('question-toggle');
    
    setTopics(prevTopics => {
      const updatedTopics = prevTopics.map(topic => 
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
      );
      
      if (user) {
        const updatedQuestion = updatedTopics
          .find(t => t.id === topicId)
          ?.subtopics.find(s => s.id === subtopicId)
          ?.questions[questionIndex];
        if (updatedQuestion) {
          setIsSaving(true);
          performanceMonitor.measureAsync(
            'firestore-update-question',
            () => updateQuestionProgress(user.uid, topicId, subtopicId, questionIndex, updatedQuestion.completed)
          ).then(() => {
            setIsSaving(false);
          }).catch(error => {
            console.error('Error updating question progress:', error);
            setIsSaving(false);
            showToast('Failed to save question progress. Please try again.', 'error');
          });
        }
      }
      
      performanceMonitor.endTiming('question-toggle');
      return updatedTopics;
    });
  }, [user, showToast]);

  if (isInitialLoad) {
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
      <Auth user={user} showToast={showToast} />
      <Toast 
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
      />
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
              <p>Welcome back, {user.displayName}! Your progress is synced.
                {isSaving && <span className="saving-indicator"> • Saving...</span>}
                {isDataSyncing && <span className="syncing-indicator"> • Syncing...</span>}
              </p>
            </div>
          )}
          {currentQuote && (
            <div className="quote-container">
              <p className="quote-text">"{currentQuote}"</p>
            </div>
          )}
        </header>

        <ProgressBar progress={progressStats.overallProgress} />

        <div className="action-buttons">
          <button 
            onClick={() => setShowLeetCode(!showLeetCode)}
            className="toggle-button"
          >
            {showLeetCode ? 'Hide LeetCode Profile' : 'Show LeetCode Profile'}
          </button>
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
