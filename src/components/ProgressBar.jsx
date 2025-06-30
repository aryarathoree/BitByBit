import React from 'react';
import './ProgressBar.css';

const ProgressBar = ({ progress }) => {
  return (
    <div className="progress-container">
      <div className="progress-header">
        <h2 className="progress-title">Your Progress</h2>
        <span className="progress-percentage">{Math.round(progress)}%</span>
      </div>
      <div className="progress-bar">
        <div 
          className="progress-fill" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>
      <div className="progress-stats">
        <span className="progress-text">
          Keep going! Every completed topic brings you closer to mastery.
        </span>
      </div>
    </div>
  );
};

export default ProgressBar; 