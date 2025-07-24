import React from 'react';

// the settings menu
const SettingsModal = ({ 
    isOpen, 
    onClose, 
    onSignOut, 
    onSignIn, 
    userState, 
    theme, 
    onThemeChange, 
    minDifficulty, 
    maxDifficulty, 
    onMinDifficultyChange, 
    onMaxDifficultyChange,
    easyMode,
    onEasyModeChange
}) => {
    if (!isOpen) return null;

    const difficultyOptions = Array.from({ length: 6 }, (_, i) => i + 3);

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
                <h2 className="settings-title">Settings</h2>
                <div className="settings-item">
                    <span>Dark Mode</span>
                    <label className="switch">
                        <input type="checkbox" checked={theme === 'dark'} onChange={onThemeChange} />
                        <span className="slider round"></span>
                    </label>
                </div>
                 <div className="settings-item">
                    <span>Easy Mode (Practice)</span>
                    <label className="switch">
                        <input type="checkbox" checked={easyMode} onChange={onEasyModeChange} />
                        <span className="slider round"></span>
                    </label>
                </div>
                <div className="settings-item difficulty-range-container">
                    <span>Practice Difficulty</span>
                    <div className="difficulty-selects">
                        <select className="settings-select" value={minDifficulty} onChange={onMinDifficultyChange} disabled={easyMode}>
                            {difficultyOptions.map(num => (
                                <option key={`min-${num}`} value={num} disabled={num > maxDifficulty}>{num}</option>
                            ))}
                        </select>
                        <span>to</span>
                        <select className="settings-select" value={maxDifficulty} onChange={onMaxDifficultyChange} disabled={easyMode}>
                             {difficultyOptions.map(num => (
                                <option key={`max-${num}`} value={num} disabled={num < minDifficulty}>{num}</option>
                            ))}
                        </select>
                         <span>clues</span>
                    </div>
                </div>
                <div className="settings-item">
                    {userState === 'authenticated' ? (
                        <button className="button signout-button" onClick={onSignOut}>Sign Out</button>
                    ) : (
                        <button className="button google-button" onClick={onSignIn}>
                            <div className="google-logo-wrapper">
                                <svg viewBox="0 0 48 48" width="18px" height="18px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                            </div>
                            <span>Sign In with Google</span>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;