import React, { useState, useMemo, useCallback, memo } from 'react';
import './TopicSection.css';

const TopicSection = memo(({ topic, onSubtopicToggle, onQuestionToggle }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [expandedSubtopics, setExpandedSubtopics] = useState({});
  
  // Memoize subtopics validation and progress calculation
  const topicStats = useMemo(() => {
    const subtopics = Array.isArray(topic.subtopics) ? topic.subtopics : [];
    const completedCount = subtopics.filter(subtopic => subtopic && subtopic.completed).length;
    const totalCount = subtopics.length;
    const topicProgress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    
    return { subtopics, completedCount, totalCount, topicProgress };
  }, [topic.subtopics]);

  const handleSubtopicToggle = useCallback((subtopicId) => {
    onSubtopicToggle(topic.id, subtopicId);
  }, [topic.id, onSubtopicToggle]);

  const handleQuestionToggle = useCallback((subtopicId, questionIndex) => {
    onQuestionToggle(topic.id, subtopicId, questionIndex);
  }, [topic.id, onQuestionToggle]);

  const toggleSubtopicQuestions = useCallback((subtopicId) => {
    setExpandedSubtopics(prev => ({
      ...prev,
      [subtopicId]: !prev[subtopicId]
    }));
  }, []);

  const getDifficultyColor = useCallback((difficulty) => {
    switch (difficulty?.toLowerCase()) {
      case 'easy': return '#00b050';
      case 'medium': return '#ffa500';
      case 'hard': return '#ff4757';
      default: return '#cccccc';
    }
  }, []);

  const getQuestionProgress = useCallback((subtopic) => {
    if (!subtopic.questions || !Array.isArray(subtopic.questions) || subtopic.questions.length === 0) return 0;
    const completedQuestions = subtopic.questions.filter(q => q && q.completed).length;
    return (completedQuestions / subtopic.questions.length) * 100;
  }, []);

  const getCompletedQuestionsCount = useCallback((subtopic) => {
    if (!subtopic.questions || !Array.isArray(subtopic.questions)) return 0;
    return subtopic.questions.filter(q => q && q.completed).length;
  }, []);

  const toggleExpanded = useCallback(() => {
    setIsExpanded(prev => !prev);
  }, []);

  return (
    <div className="topic-section">
      <div 
        className="topic-header"
        onClick={toggleExpanded}
      >
        <div className="topic-info">
          <h3 className="topic-name">{topic.name}</h3>
          <span className="topic-progress">
            {topicStats.completedCount}/{topicStats.totalCount} completed
          </span>
        </div>
        <div className="topic-controls">
          <div className="topic-progress-bar">
            <div 
              className="topic-progress-fill" 
              style={{ width: `${topicStats.topicProgress}%` }}
            ></div>
          </div>
          <button className="expand-button">
            {isExpanded ? '−' : '+'}
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div className="subtopics-container">
          {topicStats.subtopics.map((subtopic) => (
            <SubtopicItem
              key={subtopic.id}
              subtopic={subtopic}
              isExpanded={expandedSubtopics[subtopic.id]}
              onToggle={handleSubtopicToggle}
              onQuestionToggle={handleQuestionToggle}
              onToggleQuestions={toggleSubtopicQuestions}
              getDifficultyColor={getDifficultyColor}
              getQuestionProgress={getQuestionProgress}
              getCompletedQuestionsCount={getCompletedQuestionsCount}
            />
          ))}
        </div>
      )}
    </div>
  );
});

// Separate memoized component for subtopic items
const SubtopicItem = memo(({ 
  subtopic, 
  isExpanded, 
  onToggle, 
  onQuestionToggle, 
  onToggleQuestions,
  getDifficultyColor,
  getQuestionProgress,
  getCompletedQuestionsCount 
}) => {
  const handleToggle = useCallback(() => {
    onToggle(subtopic.id);
  }, [subtopic.id, onToggle]);

  const handleToggleQuestions = useCallback(() => {
    onToggleQuestions(subtopic.id);
  }, [subtopic.id, onToggleQuestions]);

  const handleQuestionToggle = useCallback((questionIndex) => {
    onQuestionToggle(subtopic.id, questionIndex);
  }, [subtopic.id, onQuestionToggle]);

  const hasQuestions = subtopic.questions && Array.isArray(subtopic.questions) && subtopic.questions.length > 0;

  return (
    <div className="subtopic-item">
      <div className="subtopic-header">
        <label className="checkbox-container">
          <input
            type="checkbox"
            checked={subtopic.completed || false}
            onChange={handleToggle}
            className="checkbox-input"
          />
          <span className="checkmark"></span>
          <span className={`subtopic-name ${subtopic.completed ? 'completed' : ''}`}>
            {subtopic.name}
          </span>
        </label>
        {hasQuestions && (
          <div className="subtopic-stats">
            <span className="questions-progress">
              {getCompletedQuestionsCount(subtopic)}/{subtopic.questions.length} questions
            </span>
            <button 
              className="questions-toggle"
              onClick={handleToggleQuestions}
              title="View LeetCode Questions"
            >
              <span className="questions-count">{subtopic.questions.length}</span>
              <span className="questions-icon">🔗</span>
            </button>
          </div>
        )}
      </div>
      
      {hasQuestions && isExpanded && (
        <QuestionsContainer 
          questions={subtopic.questions}
          progress={getQuestionProgress(subtopic)}
          onQuestionToggle={handleQuestionToggle}
          getDifficultyColor={getDifficultyColor}
        />
      )}
    </div>
  );
});

// Separate memoized component for questions container
const QuestionsContainer = memo(({ questions, progress, onQuestionToggle, getDifficultyColor }) => {
  return (
    <div className="questions-container">
      <div className="questions-header">
        <span className="questions-title">Practice Questions:</span>
        <div className="questions-progress-bar">
          <div 
            className="questions-progress-fill" 
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>
      <div className="questions-list">
        {questions.map((question, index) => (
          <QuestionItem
            key={`${question.title}-${index}`}
            question={question}
            index={index}
            onToggle={onQuestionToggle}
            getDifficultyColor={getDifficultyColor}
          />
        ))}
      </div>
    </div>
  );
});

// Separate memoized component for question items
const QuestionItem = memo(({ question, index, onToggle, getDifficultyColor }) => {
  const handleToggle = useCallback(() => {
    onToggle(index);
  }, [index, onToggle]);

  return (
    <div className="question-item">
      <label className="question-checkbox-container">
        <input
          type="checkbox"
          checked={question.completed || false}
          onChange={handleToggle}
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
  );
});

TopicSection.displayName = 'TopicSection';
SubtopicItem.displayName = 'SubtopicItem';
QuestionsContainer.displayName = 'QuestionsContainer';
QuestionItem.displayName = 'QuestionItem';

export default TopicSection; 