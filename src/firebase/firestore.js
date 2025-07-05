import { db } from './config';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  increment
} from 'firebase/firestore';

const userDocCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;
const getCachedUserDoc = (userId) => {
  const cached = userDocCache.get(userId);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  return null;
};


const setCachedUserDoc = (userId, data) => {
  userDocCache.set(userId, {
    data,
    timestamp: Date.now()
  });
};


const invalidateCache = (userId) => {
  userDocCache.delete(userId);
};


const validateTopicsData = (topics) => {
  if (!Array.isArray(topics)) {
    return [];
  }
  
  return topics.map(topic => ({
    ...topic,
    subtopics: Array.isArray(topic.subtopics) ? topic.subtopics.map(subtopic => ({
      ...subtopic,
      completed: subtopic.completed || false,
      questions: Array.isArray(subtopic.questions) ? subtopic.questions.map(question => ({
        ...question,
        completed: question.completed || false,
        title: question.title || '',
        url: question.url || '',
        difficulty: question.difficulty || 'Easy'
      })) : []
    })) : []
  }));
};


export const saveUserProgress = async (userId, topics) => {
  if (!db) {
    console.warn('Firestore not initialized');
    return false;
  }

  try {

    const validatedTopics = validateTopicsData(Array.isArray(topics) ? topics : topics.topics || []);
    

    const stats = validatedTopics.reduce((acc, topic) => {
      const subtopics = Array.isArray(topic.subtopics) ? topic.subtopics : [];
      const completedSubtopics = subtopics.filter(st => st.completed).length;
      const totalQuestions = subtopics.reduce((sum, st) => 
        sum + (Array.isArray(st.questions) ? st.questions.length : 0), 0);
      const completedQuestions = subtopics.reduce((sum, st) => 
        sum + (Array.isArray(st.questions) ? st.questions.filter(q => q.completed).length : 0), 0);
      
      acc.totalSubtopics += subtopics.length;
      acc.completedSubtopics += completedSubtopics;
      acc.totalQuestions += totalQuestions;
      acc.completedQuestions += completedQuestions;
      
      if (completedSubtopics > 0) {
        acc.completedTopics += 1;
      }
      
      return acc;
    }, {
      totalSubtopics: 0,
      completedSubtopics: 0,
      totalQuestions: 0,
      completedQuestions: 0,
      completedTopics: 0
    });


    const cleanStats = Object.fromEntries(
      Object.entries(stats).filter(([key, value]) => value !== undefined)
    );

    const progressData = {
      topics: validatedTopics,
      lastUpdated: new Date().toISOString(),
      totalTopics: validatedTopics.length,
      ...cleanStats
    };


    const cleanProgressData = JSON.parse(JSON.stringify(progressData));

    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, cleanProgressData, { merge: true });
    
    // Update cache
    setCachedUserDoc(userId, cleanProgressData);
    
    return true;
  } catch (error) {
    console.error('Error saving progress to Firestore:', error);
    

    
    return false;
  }
};


export const saveLeetCodeUsername = async (userId, leetCodeUsername) => {
  if (!db) {
    console.warn('Firestore not initialized');
    return false;
  }

  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      leetCodeUsername: leetCodeUsername,
      lastUpdated: new Date().toISOString()
    });
    
    // Update cache
    const cached = getCachedUserDoc(userId);
    if (cached) {
      setCachedUserDoc(userId, {
        ...cached,
        leetCodeUsername,
        lastUpdated: new Date().toISOString()
      });
    }
    
    return true;
  } catch (error) {
    console.error('Error saving LeetCode username:', error);
    return false;
  }
};


export const loadLeetCodeUsername = async (userId) => {
  if (!db) {
    console.warn('Firestore not initialized');
    return '';
  }

  try {
    // Check cache first
    const cached = getCachedUserDoc(userId);
    if (cached && cached.leetCodeUsername) {
      return cached.leetCodeUsername;
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      setCachedUserDoc(userId, data);
      return data.leetCodeUsername || '';
    }
    return '';
  } catch (error) {
    console.error('Error loading LeetCode username:', error);
    return '';
  }
};


export const loadUserProgress = async (userId) => {
  if (!db) {
    console.warn('Firestore not initialized');
    return null;
  }

  try {
    // Check cache first
    const cached = getCachedUserDoc(userId);
    if (cached && cached.topics) {
      return validateTopicsData(cached.topics);
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      setCachedUserDoc(userId, data);
      
      const topics = data.topics || [];
      const validatedTopics = validateTopicsData(topics);
      
      return validatedTopics;
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error loading progress from Firestore:', error);
    return null;
  }
};


export const updateTopicProgress = async (userId, topicId, subtopicId, completed) => {
  if (!db) {
    console.warn('Firestore not initialized');
    return false;
  }

  try {
    const userRef = doc(db, 'users', userId);
    
    // Get current data from cache or Firestore
    let currentData = getCachedUserDoc(userId);
    if (!currentData) {
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) return false;
      currentData = userDoc.data();
      setCachedUserDoc(userId, currentData);
    }
    
    const topics = validateTopicsData(currentData.topics || []);
    

    const updatedTopics = topics.map(topic => {
      if (topic.id === topicId) {
        return {
          ...topic,
          subtopics: Array.isArray(topic.subtopics) ? topic.subtopics.map(subtopic => 
            subtopic.id === subtopicId 
              ? { ...subtopic, completed: completed }
              : subtopic
          ) : []
        };
      }
      return topic;
    });
    

    
    // Update Firestore with optimized write
    await updateDoc(userRef, {
      topics: updatedTopics,
      lastUpdated: new Date().toISOString()
    });
    
    // Update cache
    setCachedUserDoc(userId, {
      ...currentData,
      topics: updatedTopics,
      lastUpdated: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('Error updating topic progress:', error);
    return false;
  }
};


export const updateQuestionProgress = async (userId, topicId, subtopicId, questionIndex, completed) => {
  if (!db) {
    console.warn('Firestore not initialized');
    return false;
  }

  try {
    const userRef = doc(db, 'users', userId);
    
    // Get current data from cache or Firestore
    let currentData = getCachedUserDoc(userId);
    if (!currentData) {
      const userDoc = await getDoc(userRef);
      if (!userDoc.exists()) return false;
      currentData = userDoc.data();
      setCachedUserDoc(userId, currentData);
    }
    
    const topics = validateTopicsData(currentData.topics || []);
    

    const updatedTopics = topics.map(topic => {
      if (topic.id === topicId) {
        return {
          ...topic,
          subtopics: Array.isArray(topic.subtopics) ? topic.subtopics.map(subtopic => 
            subtopic.id === subtopicId 
              ? { 
                  ...subtopic, 
                  questions: Array.isArray(subtopic.questions) ? subtopic.questions.map((question, index) =>
                    index === questionIndex 
                      ? { ...question, completed: completed }
                      : question
                  ) : []
                }
              : subtopic
          ) : []
        };
      }
      return topic;
    });
    

    
    // Update Firestore with optimized write
    await updateDoc(userRef, {
      topics: updatedTopics,
      lastUpdated: new Date().toISOString()
    });
    
    // Update cache
    setCachedUserDoc(userId, {
      ...currentData,
      topics: updatedTopics,
      lastUpdated: new Date().toISOString()
    });
    
    return true;
  } catch (error) {
    console.error('Error updating question progress:', error);
    return false;
  }
};


export const getUserStats = async (userId) => {
  if (!db) {
    console.warn('Firestore not initialized');
    return null;
  }

  try {
    // Check cache first
    const cached = getCachedUserDoc(userId);
    if (cached) {
      return {
        totalTopics: cached.totalTopics || 0,
        completedTopics: cached.completedTopics || 0,
        totalSubtopics: cached.totalSubtopics || 0,
        completedSubtopics: cached.completedSubtopics || 0,
        totalQuestions: cached.totalQuestions || 0,
        completedQuestions: cached.completedQuestions || 0,
        lastUpdated: cached.lastUpdated
      };
    }

    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      setCachedUserDoc(userId, data);
      
      return {
        totalTopics: data.totalTopics || 0,
        completedTopics: data.completedTopics || 0,
        totalSubtopics: data.totalSubtopics || 0,
        completedSubtopics: data.completedSubtopics || 0,
        totalQuestions: data.totalQuestions || 0,
        completedQuestions: data.completedQuestions || 0,
        lastUpdated: data.lastUpdated
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user stats:', error);
    return null;
  }
};


export const getAllUsers = async () => {
  if (!db) {
    console.warn('Firestore not initialized');
    return [];
  }

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef);
    const querySnapshot = await getDocs(q);
    
    const users = [];
    querySnapshot.forEach((doc) => {
      users.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    return users;
  } catch (error) {
    console.error('Error getting all users:', error);
    return [];
  }
};


export const clearUserCache = (userId) => {
  if (userId) {
    invalidateCache(userId);
  } else {
    userDocCache.clear();
  }
};

 