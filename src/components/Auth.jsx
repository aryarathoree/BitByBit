import React, { useState } from 'react';
import { auth } from '../firebase/config';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import './Auth.css';

const Auth = ({ user, onAuthStateChange, showToast }) => {
  const [isLoading, setIsLoading] = useState(false);

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      if (showToast) {
        showToast('Error signing in. Please try again.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await signOut(auth);
      if (showToast) {
        showToast('Successfully signed out. Your progress is now stored locally.', 'info');
      }
    } catch (error) {
      console.error('Error signing out:', error);
      if (showToast) {
        showToast('Error signing out. Please try again.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-container">
      {user ? (
        <div className="user-info">
          <img 
            src={user.photoURL} 
            alt={user.displayName} 
            className="user-avatar"
          />
          <span className="user-name">{user.displayName}</span>
          <button 
            onClick={handleSignOut} 
            disabled={isLoading}
            className="auth-button sign-out"
          >
            {isLoading ? 'Signing Out...' : 'Sign Out'}
          </button>
        </div>
      ) : (
        <button 
          onClick={signInWithGoogle} 
          disabled={isLoading}
          className="auth-button sign-in"
        >
          {isLoading ? 'Signing In...' : 'Sign In with Google'}
        </button>
      )}
    </div>
  );
};

export default Auth; 