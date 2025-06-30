import { db } from './config';
import { 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';

// Save user progress to Firestore
export const saveUserProgress = async (userId, topics) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      topics: topics,
      lastUpdated: new Date().toISOString(),
      totalTopics: topics.length,
      completedTopics: topics.filter(topic => 
        topic.subtopics.some(subtopic => subtopic.completed)
      ).length,
      totalSubtopics: topics.reduce((total, topic) => total + topic.subtopics.length, 0),
      completedSubtopics: topics.reduce((total, topic) => 
        total + topic.subtopics.filter(subtopic => subtopic.completed).length, 0
      )
    }, { merge: true });
    
    console.log('Progress saved to Firestore successfully');
    return true;
  } catch (error) {
    console.error('Error saving progress to Firestore:', error);
    return false;
  }
};

// Save LeetCode username to Firestore
export const saveLeetCodeUsername = async (userId, leetCodeUsername) => {
  try {
    const userRef = doc(db, 'users', userId);
    await setDoc(userRef, {
      leetCodeUsername: leetCodeUsername
    }, { merge: true });
    return true;
  } catch (error) {
    console.error('Error saving LeetCode username:', error);
    return false;
  }
};

// Load LeetCode username from Firestore
export const loadLeetCodeUsername = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      const data = userDoc.data();
      return data.leetCodeUsername || '';
    }
    return '';
  } catch (error) {
    console.error('Error loading LeetCode username:', error);
    return '';
  }
};

// Load user progress from Firestore
export const loadUserProgress = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      console.log('Progress loaded from Firestore successfully');
      return data.topics || null;
    } else {
      console.log('No existing progress found for user');
      return null;
    }
  } catch (error) {
    console.error('Error loading progress from Firestore:', error);
    return null;
  }
};

// Update specific topic progress
export const updateTopicProgress = async (userId, topicId, subtopicId, completed) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      const updatedTopics = data.topics.map(topic => {
        if (topic.id === topicId) {
          return {
            ...topic,
            subtopics: topic.subtopics.map(subtopic => 
              subtopic.id === subtopicId 
                ? { ...subtopic, completed: completed }
                : subtopic
            )
          };
        }
        return topic;
      });
      
      await saveUserProgress(userId, updatedTopics);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error updating topic progress:', error);
    return false;
  }
};

// Get user statistics
export const getUserStats = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
        totalTopics: data.totalTopics || 0,
        completedTopics: data.completedTopics || 0,
        totalSubtopics: data.totalSubtopics || 0,
        completedSubtopics: data.completedSubtopics || 0,
        lastUpdated: data.lastUpdated
      };
    }
    return null;
  } catch (error) {
    console.error('Error getting user stats:', error);
    return null;
  }
};

// Get all users (for admin purposes)
export const getAllUsers = async () => {
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