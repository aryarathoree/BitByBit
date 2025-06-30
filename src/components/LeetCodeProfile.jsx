import React, { useState, useEffect } from 'react';
import { saveLeetCodeUsername, loadLeetCodeUsername } from '../firebase/firestore';
import { auth } from '../firebase/config';
import './LeetCodeProfile.css';

const LeetCodeProfile = ({ user }) => {
  const [username, setUsername] = useState('');
  const [userStats, setUserStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  // Load saved username and auto-fetch stats if user is signed in
  useEffect(() => {
    const fetchSavedUsername = async () => {
      if (user) {
        setIsLoading(true);
        const saved = await loadLeetCodeUsername(user.uid);
        if (saved) {
          setUsername(saved);
          await fetchLeetCodeStats(saved);
        }
        setIsLoading(false);
      } else {
        // Clear data when user signs out
        setUsername('');
        setUserStats(null);
        setError('');
      }
    };
    fetchSavedUsername();
  }, [user]);

  const fetchLeetCodeStats = async (leetcodeUsername) => {
    try {
      // Fetch main stats
      const contestResponse = await fetch(`https://leetcode-stats-api.herokuapp.com/${leetcodeUsername}`);
      
      if (!contestResponse.ok) {
        throw new Error('User not found');
      }

      const contestData = await contestResponse.json();
      
      if (contestData.status === 'error') {
        throw new Error(contestData.message || 'User not found');
      }

      // Fetch additional detailed stats
      let additionalStats = null;
      let submissionCalendar = null;
      
      try {
        const statsResponse = await fetch(`https://alfa-leetcode-api.onrender.com/${leetcodeUsername}/solved`);
        if (statsResponse.ok) {
          additionalStats = await statsResponse.json();
        }
      } catch (err) {
        console.log('Additional stats not available:', err);
      }

      // Fetch submission calendar data
      try {
        const calendarResponse = await fetch(`https://alfa-leetcode-api.onrender.com/${leetcodeUsername}/calendar`);
        if (calendarResponse.ok) {
          const calendarData = await calendarResponse.json();
          // The API returns calendar data as a JSON string, so we need to parse it
          let calendarObj = {};
          if (calendarData.submissionCalendar) {
            try {
              calendarObj = JSON.parse(calendarData.submissionCalendar);
            } catch (parseErr) {
              console.log('Failed to parse calendar data:', parseErr);
              calendarObj = {};
            }
          }
          submissionCalendar = calendarObj;
        }
      } catch (err) {
        console.log('Calendar data not available:', err);
        submissionCalendar = {};
      }

      // If no calendar data found, try the primary API
      if (!submissionCalendar || Object.keys(submissionCalendar).length === 0) {
        try {
          if (contestData.submissionCalendar) {
            submissionCalendar = typeof contestData.submissionCalendar === 'string' 
              ? JSON.parse(contestData.submissionCalendar)
              : contestData.submissionCalendar;
          }
        } catch (parseErr) {
          console.log('Failed to parse primary API calendar:', parseErr);
        }
      }

      // If still no data, generate sample data for demonstration (for common usernames)
      if ((!submissionCalendar || Object.keys(submissionCalendar).length === 0) && 
          ['testuser', 'demo', 'example'].includes(leetcodeUsername.toLowerCase())) {
        submissionCalendar = generateSampleCalendarData();
      }

      // Combine the data
      const combinedStats = {
        username: leetcodeUsername,
        profile: {
          realName: contestData.name || null,
          ranking: contestData.ranking || null,
          reputation: contestData.reputation || 0
        },
        submitStats: {
          acSubmissionNum: [
            { difficulty: 'Easy', count: additionalStats?.easySolved || contestData.easySolved || 0 },
            { difficulty: 'Medium', count: additionalStats?.mediumSolved || contestData.mediumSolved || 0 },
            { difficulty: 'Hard', count: additionalStats?.hardSolved || contestData.hardSolved || 0 }
          ]
        },
        contestStats: {
          rating: contestData.contestRating || 0,
          globalRanking: contestData.contestGlobalRanking || null,
          totalParticipated: contestData.totalParticipated || 0
        },
        submissionCalendar: submissionCalendar || {},
        acceptanceRate: contestData.acceptanceRate || 0,
        totalQuestions: contestData.totalQuestions || 0
      };

      setUserStats(combinedStats);
      setError('');
    } catch (err) {
      console.error('Error fetching LeetCode stats:', err);
      setError(err.message || 'Failed to fetch LeetCode stats');
      setUserStats(null);
    }
  };

  // Generate sample calendar data for demonstration
  const generateSampleCalendarData = () => {
    const calendar = {};
    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    
    // Generate random submission data for the past year
    const currentDate = new Date(oneYearAgo);
    while (currentDate <= today) {
      // Add submissions on random days (about 40% of days)
      if (Math.random() < 0.4) {
        const timestamp = Math.floor(currentDate.getTime() / 1000);
        // Random submission count (1-15)
        const count = Math.floor(Math.random() * 15) + 1;
        calendar[timestamp] = count;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    return calendar;
  };

  const handleFetch = async () => {
    if (!username.trim()) {
      setError('Please enter a LeetCode username');
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    await fetchLeetCodeStats(username);
    
    // Save to Firestore if signed in and stats were fetched successfully
    if (user && userStats) {
      await saveLeetCodeUsername(user.uid, username);
    }
    
    setIsLoading(false);
  };

  const renderSubmissionCalendar = () => {
    if (!userStats?.submissionCalendar) {
      return (
        <div className="submission-calendar">
          <h4>Submission Activity</h4>
          <div className="calendar-placeholder">
            <p>No submission data available for this user.</p>
          </div>
        </div>
      );
    }

    const calendar = userStats.submissionCalendar;
    console.log('Calendar data:', calendar); // Debug log
    
    // If calendar is empty, show placeholder
    if (!calendar || Object.keys(calendar).length === 0) {
      return (
        <div className="submission-calendar">
          <h4>Submission Activity</h4>
          <div className="calendar-placeholder">
            <p>No submission activity found for this user.</p>
          </div>
        </div>
      );
    }

    const today = new Date();
    const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
    
    // Convert calendar object to array of dates with better error handling
    const submissions = Object.entries(calendar).map(([timestamp, count]) => {
      const parsedTimestamp = parseInt(timestamp);
      if (isNaN(parsedTimestamp)) {
        console.warn('Invalid timestamp:', timestamp);
        return null;
      }
      return {
        date: new Date(parsedTimestamp * 1000),
        count: parseInt(count) || 0,
        timestamp: parsedTimestamp
      };
    }).filter(Boolean); // Remove null entries

    console.log('Parsed submissions:', submissions.slice(0, 5)); // Debug log

    // Generate month-wise calendar data
    const monthsData = [];
    const currentDate = new Date(oneYearAgo);
    
    while (currentDate <= today) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const monthKey = `${year}-${month}`;
      
      let monthData = monthsData.find(m => m.key === monthKey);
      if (!monthData) {
        monthData = {
          key: monthKey,
          year: year,
          month: month,
          name: currentDate.toLocaleDateString('en-US', { month: 'short' }),
          weeks: []
        };
        monthsData.push(monthData);
      }
      
      // Find or create week
      const weekStart = new Date(currentDate);
      weekStart.setDate(currentDate.getDate() - currentDate.getDay()); // Start of week (Sunday)
      const weekKey = weekStart.toISOString().split('T')[0];
      
      let week = monthData.weeks.find(w => w.key === weekKey);
      if (!week) {
        week = {
          key: weekKey,
          days: new Array(7).fill(null)
        };
        monthData.weeks.push(week);
      }
      
      // Add day data
      const dayOfWeek = currentDate.getDay();
      const currentTimestamp = Math.floor(currentDate.getTime() / 1000);
      const submission = submissions.find(s => {
        const dayStart = Math.floor(currentDate.getTime() / 1000);
        const dayEnd = dayStart + 86400;
        return s.timestamp >= dayStart && s.timestamp < dayEnd;
      });
      
      week.days[dayOfWeek] = {
        date: new Date(currentDate),
        count: submission ? submission.count : 0,
        isCurrentMonth: currentDate.getMonth() === month
      };
      
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const getIntensity = (count) => {
      if (count === 0) return 'intensity-0';
      if (count <= 3) return 'intensity-1';
      if (count <= 6) return 'intensity-2';
      if (count <= 10) return 'intensity-3';
      return 'intensity-4';
    };

    const totalSubmissions = submissions.reduce((sum, sub) => sum + sub.count, 0);

    return (
      <div className="submission-calendar">
        <h4>Submission Activity</h4>
        <div className="calendar-stats">
          <span>{totalSubmissions} submissions in the last year</span>
        </div>
        
        <div className="calendar-container">
          <div className="calendar-months">
            {monthsData.map((monthData) => (
              <div key={monthData.key} className="calendar-month">
                <div className="month-header">
                  <span className="month-name">{monthData.name}</span>
                </div>
                <div className="month-grid">
                  <div className="weekdays">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                      <div key={i} className="weekday-label">{day}</div>
                    ))}
                  </div>
                  <div className="weeks">
                    {monthData.weeks.map((week) => (
                      <div key={week.key} className="week-row">
                        {week.days.map((day, dayIndex) => (
                          <div
                            key={dayIndex}
                            className={`calendar-day ${day ? getIntensity(day.count) : 'empty'} ${
                              day && !day.isCurrentMonth ? 'other-month' : ''
                            }`}
                            title={day ? `${day.date.toDateString()}: ${day.count} submissions` : ''}
                          >
                            {day && day.isCurrentMonth && (
                              <span className="day-number">{day.date.getDate()}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="calendar-legend">
          <span>Less</span>
          <div className="legend-squares">
            <div className="legend-square intensity-0"></div>
            <div className="legend-square intensity-1"></div>
            <div className="legend-square intensity-2"></div>
            <div className="legend-square intensity-3"></div>
            <div className="legend-square intensity-4"></div>
          </div>
          <span>More</span>
        </div>
      </div>
    );
  };

  const renderProgressChart = () => {
    if (!userStats) return null;

    const stats = userStats.submitStats.acSubmissionNum;
    const easyCount = stats.find(s => s.difficulty === 'Easy')?.count || 0;
    const mediumCount = stats.find(s => s.difficulty === 'Medium')?.count || 0;
    const hardCount = stats.find(s => s.difficulty === 'Hard')?.count || 0;
    const totalSolved = easyCount + mediumCount + hardCount;

    const easyPercentage = totalSolved > 0 ? (easyCount / totalSolved) * 100 : 0;
    const mediumPercentage = totalSolved > 0 ? (mediumCount / totalSolved) * 100 : 0;
    const hardPercentage = totalSolved > 0 ? (hardCount / totalSolved) * 100 : 0;

    return (
      <div className="progress-chart">
        <h4>Problem Distribution</h4>
        <div className="chart-container">
          <div className="donut-chart">
            <svg viewBox="0 0 100 100" className="chart-svg">
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#333"
                strokeWidth="8"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#00ff00"
                strokeWidth="8"
                strokeDasharray={`${easyPercentage * 2.51} 251`}
                strokeDashoffset="0"
                transform="rotate(-90 50 50)"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#ffa500"
                strokeWidth="8"
                strokeDasharray={`${mediumPercentage * 2.51} 251`}
                strokeDashoffset={`-${easyPercentage * 2.51}`}
                transform="rotate(-90 50 50)"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#ff0000"
                strokeWidth="8"
                strokeDasharray={`${hardPercentage * 2.51} 251`}
                strokeDashoffset={`-${(easyPercentage + mediumPercentage) * 2.51}`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="chart-center">
              <span className="total-count">{totalSolved}</span>
              <span className="total-label">Solved</span>
            </div>
          </div>
          <div className="chart-legend">
            <div className="legend-item">
              <div className="legend-color easy"></div>
              <span>Easy ({easyCount})</span>
            </div>
            <div className="legend-item">
              <div className="legend-color medium"></div>
              <span>Medium ({mediumCount})</span>
            </div>
            <div className="legend-item">
              <div className="legend-color hard"></div>
              <span>Hard ({hardCount})</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderStatsCard = () => {
    if (!userStats) return null;

    const { username: leetUsername, profile, submitStats, contestStats } = userStats;
    const stats = submitStats.acSubmissionNum;
    
    const easyCount = stats.find(s => s.difficulty === 'Easy')?.count || 0;
    const mediumCount = stats.find(s => s.difficulty === 'Medium')?.count || 0;
    const hardCount = stats.find(s => s.difficulty === 'Hard')?.count || 0;
    const totalSolved = easyCount + mediumCount + hardCount;

    return (
      <div className="leetcode-stats-card">
        <div className="stats-header">
          <div className="user-info">
            <h4>{leetUsername}</h4>
            {profile.realName && <p className="real-name">{profile.realName}</p>}
          </div>
          <div className="ranking">
            <span className="rank-label">Global Ranking</span>
            <span className="rank-value">{profile.ranking ? `#${profile.ranking.toLocaleString()}` : 'N/A'}</span>
          </div>
        </div>

        <div className="stats-tabs">
          <button 
            className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={`tab-button ${activeTab === 'charts' ? 'active' : ''}`}
            onClick={() => setActiveTab('charts')}
          >
            Charts
          </button>
          <button 
            className={`tab-button ${activeTab === 'activity' ? 'active' : ''}`}
            onClick={() => setActiveTab('activity')}
          >
            Activity
          </button>
        </div>
        
        <div className="stats-body">
          {activeTab === 'overview' && (
            <>
              <div className="total-solved">
                <span className="total-number">{totalSolved}</span>
                <span className="total-label">Problems Solved</span>
                <span className="acceptance-rate">
                  {userStats.acceptanceRate}% Acceptance Rate
                </span>
              </div>
              
              <div className="difficulty-stats">
                <div className="difficulty-item easy">
                  <div className="difficulty-circle easy-bg"></div>
                  <span className="difficulty-name">Easy</span>
                  <span className="difficulty-count">{easyCount}</span>
                </div>
                <div className="difficulty-item medium">
                  <div className="difficulty-circle medium-bg"></div>
                  <span className="difficulty-name">Medium</span>
                  <span className="difficulty-count">{mediumCount}</span>
                </div>
                <div className="difficulty-item hard">
                  <div className="difficulty-circle hard-bg"></div>
                  <span className="difficulty-name">Hard</span>
                  <span className="difficulty-count">{hardCount}</span>
                </div>
              </div>
              
              {contestStats && (contestStats.rating > 0 || contestStats.totalParticipated > 0) && (
                <div className="contest-stats">
                  <div className="contest-item">
                    <span className="contest-label">Contest Rating</span>
                    <span className="contest-value">{contestStats.rating || 'N/A'}</span>
                  </div>
                  <div className="contest-item">
                    <span className="contest-label">Contests Participated</span>
                    <span className="contest-value">{contestStats.totalParticipated || 0}</span>
                  </div>
                  {contestStats.globalRanking && (
                    <div className="contest-item">
                      <span className="contest-label">Contest Ranking</span>
                      <span className="contest-value">#{contestStats.globalRanking.toLocaleString()}</span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {activeTab === 'charts' && renderProgressChart()}
          
          {activeTab === 'activity' && renderSubmissionCalendar()}
        </div>
      </div>
    );
  };

  return (
    <div className="leetcode-profile">
      <div className="leetcode-header">
        <h3>LeetCode Profile</h3>
        {user && userStats ? (
          <p>Welcome back! Your LeetCode stats are automatically loaded.</p>
        ) : user ? (
          <p>Enter your LeetCode username to fetch your stats, charts, and activity</p>
        ) : (
          <p>Sign in to save your LeetCode username and view your stats automatically</p>
        )}
      </div>
      
      {/* Show input only if no stats are loaded or user wants to change username */}
      {(!userStats || !user) && (
        <div className="leetcode-input">
          <input
            type="text"
            placeholder="Enter LeetCode username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleFetch()}
            className="username-input"
          />
          <button 
            onClick={handleFetch}
            disabled={isLoading}
            className="fetch-button"
          >
            {isLoading ? 'Fetching...' : 'Fetch Stats'}
          </button>
        </div>
      )}

      {/* Show change username option when user is logged in and has stats */}
      {user && userStats && (
        <div className="username-management">
          <div className="current-username">
            <span className="username-label">Current LeetCode ID:</span>
            <span className="username-value">{username}</span>
            <button 
              onClick={() => setUserStats(null)}
              className="change-username-btn"
            >
              Change Username
            </button>
          </div>
          <button 
            onClick={() => fetchLeetCodeStats(username)}
            disabled={isLoading}
            className="refresh-button"
          >
            {isLoading ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        </div>
      )}

      {error && (
        <div className="error-message">{error}</div>
      )}
      
      {userStats && !error && (
        <div className="leetcode-stats-container">
          {renderStatsCard()}
          {user && (
            <div className="leetcode-note">
              <span>Your LeetCode username is automatically saved to your account.</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LeetCodeProfile; 