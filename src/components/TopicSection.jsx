import React, { useState } from 'react';
import './TopicSection.css';

const TopicSection = ({ topic, onSubtopicToggle, onQuestionToggle }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSubtopics, setExpandedSubtopics] = useState({});
  
  const completedCount = topic.subtopics.filter(subtopic => subtopic.completed).length;
  const totalCount = topic.subtopics.length;
  const topicProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  const handleSubtopicToggle = (subtopicId) => {
    onSubtopicToggle(topic.id, subtopicId);
  };

  const handleQuestionToggle = (subtopicId, questionIndex) => {
    onQuestionToggle(topic.id, subtopicId, questionIndex);
  };

  const toggleSubtopicQuestions = (subtopicId) => {
    setExpandedSubtopics(prev => ({
      ...prev,
      [subtopicId]: !prev[subtopicId]
    }));
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return '#00b050';
      case 'medium': return '#ffa500';
      case 'hard': return '#ff4757';
      default: return '#cccccc';
    }
  };

  const getQuestionProgress = (subtopic) => {
    if (!subtopic.questions || subtopic.questions.length === 0) return 0;
    const completedQuestions = subtopic.questions.filter(q => q.completed).length;
    return (completedQuestions / subtopic.questions.length) * 100;
  };

  const getCompletedQuestionsCount = (subtopic) => {
    if (!subtopic.questions) return 0;
    return subtopic.questions.filter(q => q.completed).length;
  };

  return (
    <div className="topic-section">
      <div 
        className="topic-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="topic-info">
          <h3 className="topic-name">{topic.name}</h3>
          <span className="topic-progress">
            {completedCount}/{totalCount} completed
          </span>
        </div>
        <div className="topic-controls">
          <div className="topic-progress-bar">
            <div 
              className="topic-progress-fill" 
              style={{ width: `${topicProgress}%` }}
            ></div>
          </div>
          <button className="expand-button">
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="subtopics-container">
          {topic.subtopics.map((subtopic) => (
            <div key={subtopic.id} className="subtopic-item">
              <div className="subtopic-header">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={subtopic.completed}
                    onChange={() => handleSubtopicToggle(subtopic.id)}
                    className="checkbox-input"
                  />
                  <span className="checkmark"></span>
                  <span className={`subtopic-name ${subtopic.completed ? 'completed' : ''}`}>
                    {subtopic.name}
                  </span>
                </label>
                {subtopic.questions && subtopic.questions.length > 0 && (
                  <div className="subtopic-stats">
                    <span className="questions-progress">
                      {getCompletedQuestionsCount(subtopic)}/{subtopic.questions.length} questions
                    </span>
                    <button 
                      className="questions-toggle"
                      onClick={() => toggleSubtopicQuestions(subtopic.id)}
                      title="View LeetCode Questions"
                    >
                      <span className="questions-count">{subtopic.questions.length}</span>
                      <span className="questions-icon">🔗</span>
                    </button>
                  </div>
                )}
              </div>
              
              {subtopic.questions && expandedSubtopics[subtopic.id] && (
                <div className="questions-container">
                  <div className="questions-header">
                    <span className="questions-title">Practice Questions:</span>
                    <div className="questions-progress-bar">
                      <div 
                        className="questions-progress-fill" 
                        style={{ width: `${getQuestionProgress(subtopic)}%` }}
                      ></div>
                    </div>
                  </div>
                  <div className="questions-list">
                    {subtopic.questions.map((question, index) => (
                      <div key={index} className="question-item">
                        <label className="question-checkbox-container">
                          <input
                            type="checkbox"
                            checked={question.completed || false}
                            onChange={() => handleQuestionToggle(subtopic.id, index)}
                            className="question-checkbox-input"
                          />
                          <span className="question-checkmark"></span>
                        </label>
                        <a 
                          href={question.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className={`question-link ${question.completed ? 'completed' : ''}`}
                        >
                          <span className="question-title">{question.title}</span>
                          <span 
                            className="question-difficulty"
                            style={{ color: getDifficultyColor(question.difficulty) }}
                          >
                            {question.difficulty}
                          </span>
                          <span className="external-link-icon">↗</span>
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TopicSection; 