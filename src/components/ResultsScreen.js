import React from 'react';

// the popup that shows game results
const ResultsScreen = ({ isWin, time, onPlayAgain, isPractice, onClose, handleShare }) => {
    // formats seconds into a 'minutes seconds' string
    const formatTime = (totalSeconds) => {
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        
        const minutesString = minutes > 0 ? `${minutes} minute${minutes > 1 ? 's' : ''}` : '';
        const secondsString = seconds > 0 || minutes === 0 ? `${seconds} second${seconds !== 1 ? 's' : ''}` : '';
        
        return [minutesString, secondsString].filter(Boolean).join(', ');
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="results-container" onClick={(e) => e.stopPropagation()}>
                <button className="close-button" onClick={onClose}>×</button>
                <h2 className="results-title">{isWin ? "You solved it!" : "Out of Guesses!"}</h2>
                <div className="results-time">Your time: {formatTime(time)}</div>
                <div className="results-actions">
                    {!isPractice && (
                        <button className="button share-button" onClick={handleShare}>Share</button>
                    )}
                    {isPractice && (
                        <button className="button" onClick={onPlayAgain}>Play Another</button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ResultsScreen;