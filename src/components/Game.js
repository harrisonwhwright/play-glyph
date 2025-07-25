import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { generatePuzzle } from '../lib/puzzleGenerator';
import ResultsScreen from './ResultsScreen';

// A component for a clickable black box that hides the answer
const Spoiler = ({ value }) => {
    const [isRevealed, setIsRevealed] = useState(false);

    return (
        <div
            className={`spoiler-box ${isRevealed ? 'revealed' : ''}`}
            onClick={() => setIsRevealed(true)}
        >
            <span className="spoiler-content">{value}</span>
        </div>
    );
};

// The main game component
const Game = ({ user, isPractice, onPlayAgain, practiceDifficultyRange, easyMode, dailyState, setDailyState }) => {
    // --- State Management ---
    // The component now has a single internal state object.
    // It will be initialized based on the mode (daily or practice).
    const [gameState, setGameState] = useState({
        puzzle: null,
        elapsedTime: 0,
        isComplete: false,
        isWin: false,
        guessesLeft: 3,
        guessHistory: [],
        isTimerRunning: false,
    });

    const [inputValue, setInputValue] = useState('');
    const [showSolution, setShowSolution] = useState(false);
    const [showResultsPopup, setShowResultsPopup] = useState(false);

    // Destructure from the single internal state for cleaner access
    const { puzzle, elapsedTime, isComplete, isWin, guessesLeft, guessHistory, isTimerRunning } = gameState;

    // --- Core Game Logic ---

    // This is the main effect that initializes or updates the game state.
    useEffect(() => {
        if (isPractice) {
            // PRACTICE MODE: Generate a new puzzle and set it as the internal state.
            const puzzleSeed = Date.now();
            const currentPuzzle = generatePuzzle(puzzleSeed, practiceDifficultyRange, easyMode);
            setGameState({
                puzzle: currentPuzzle,
                elapsedTime: 0,
                isComplete: false,
                isWin: false,
                guessesLeft: 3,
                guessHistory: [],
                isTimerRunning: true,
            });
            setInputValue('');
            setShowSolution(false);
            setShowResultsPopup(false);
        } else {
            // DAILY MODE: Use the state passed down from App.js.
            // This state is already figured out (new game or completed game).
            setGameState(dailyState);
            if (dailyState.isComplete) {
                setShowResultsPopup(true);
            }
        }
    }, [isPractice, onPlayAgain, dailyState, practiceDifficultyRange, easyMode]); // Reruns when mode changes or new practice game is triggered

    // Timer effect
    useEffect(() => {
        let interval;
        if (isTimerRunning && !isComplete) {
            interval = setInterval(() => {
                setGameState(s => ({ ...s, elapsedTime: s.elapsedTime + 1 }));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isTimerRunning, isComplete]);

    // Handles the end of a game
    const endGame = useCallback((winState, finalHistory) => {
        const finalState = { ...gameState, isTimerRunning: false, isComplete: true, isWin: winState, guessHistory: finalHistory };
        setGameState(finalState);
        setShowResultsPopup(true);

        if (isPractice) {
            if (user && winState) {
                supabase.rpc('increment_practice_wins', { p_user_id: user.id }).then();
            }
        } else {
            // In daily mode, we also need to update the parent App component's state
            setDailyState(finalState);
            const playData = {
                puzzle_id: puzzle.puzzle_id,
                is_win: winState,
                duration_ms: elapsedTime * 1000,
                guess_history: finalHistory,
            };
            if (user) {
                supabase.from('plays').insert({ ...playData, user_id: user.id }).then();
                supabase.rpc('update_user_stats', { p_user_id: user.id, p_is_win: winState }).then();
            } else {
                const now = new Date();
                const year = now.getUTCFullYear();
                const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
                const day = now.getUTCDate().toString().padStart(2, '0');
                const utcDateStr = `${year}-${month}-${day}`;
                localStorage.setItem(`glyph-play-${utcDateStr}`, JSON.stringify(playData));
            }
        }
    }, [gameState, setDailyState, user, isPractice, puzzle, elapsedTime]);

    // Handles guess submission
    const handleSubmit = useCallback(() => {
        if (isComplete || !inputValue || guessesLeft === 0 || !puzzle) return;

        const currentGuess = parseInt(inputValue);
        const newHistory = [...guessHistory, currentGuess];
        const solved = currentGuess === puzzle.solution;

        if (solved) {
            setInputValue('');
            endGame(true, newHistory);
        } else {
            const newGuessesLeft = guessesLeft - 1;
            setGameState(s => ({ ...s, guessHistory: newHistory, guessesLeft: newGuessesLeft }));
            setInputValue('');
            if (newGuessesLeft === 0) {
                endGame(false, newHistory);
            }
        }
    }, [isComplete, inputValue, guessesLeft, puzzle, guessHistory, endGame]);

    // --- Keyboard Input ---
    useEffect(() => {
        const handleKeyDown = (event) => {
            if (showResultsPopup) return;
            if (event.key >= '0' && event.key <= '9' && !isComplete) {
                setInputValue(v => v.length < 3 ? v + event.key : v);
            } else if (event.key === 'Backspace' && !isComplete) {
                setInputValue(v => v.slice(0, -1));
            } else if (event.key === 'Enter' && !isComplete) {
                handleSubmit();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isComplete, showResultsPopup, handleSubmit]);

    // --- Share Text Generation ---
    const shareText = useMemo(() => {
        if (!puzzle || isPractice) return '';

        const minutes = Math.floor(elapsedTime / 60);
        const seconds = elapsedTime % 60;
        let timeString = '';
        if (minutes > 0) timeString += `${minutes}m`;
        timeString += `${seconds}s`;

        const seedStr = puzzle.puzzle_id.toString();
        const year = seedStr.substring(0, 4);
        const month = seedStr.substring(4, 6);
        const day = seedStr.substring(6, 8);
        const formattedDate = `${year}.${month}.${day}`;
        
        const score = isWin ? `${guessHistory.length}/3` : 'X/3';
        const resultSquares = guessHistory.map(g => g === puzzle.solution ? '🟩' : '⬛').join('');
        
        return `#playglyph (${formattedDate}) ${timeString} ${score} ${resultSquares} https://play-glyph.com`;
    }, [puzzle, isWin, guessHistory, elapsedTime, isPractice]);

    const handleShare = useCallback(() => {
        navigator.clipboard.writeText(shareText).then(() => {
            alert("Results copied to clipboard!");
        }).catch(err => console.error('Failed to copy', err));
    }, [shareText]);
    
    // --- Render Logic ---
    const renderClues = () => {
        if (!puzzle || !puzzle.clues || puzzle.clues.length === 0) return null;
        return puzzle.clues.map((clue, index) => {
            const isQuestion = index === puzzle.clues.length - 1;
            if (isQuestion && isComplete && isWin) {
                return <div key={index} className="clue-solved">{clue.replace('?', puzzle.solution)}</div>;
            }
            return <div key={index}>{clue}</div>;
        });
    };

    // This is the main safeguard against a blank screen.
    // It will not attempt to render the game until the puzzle object is ready.
    if (!puzzle) {
        return <div className="game-container">Loading...</div>;
    }
    
    // This calculation is now safe because we know 'puzzle' and 'puzzle.clues' exist.
    const questionGlyph = puzzle.clues && puzzle.clues.length > 0 ? puzzle.clues[puzzle.clues.length - 1].split(' ')[0] : null;

    return (
        <>
            <div className="game-container" style={{ filter: showResultsPopup ? 'blur(5px)' : 'none' }}>
                <div className="game-header">
                    <div className="timer">{new Date(elapsedTime * 1000).toISOString().substr(14, 5)}</div>
                    <div className="guess-tracker">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <span key={i} className={i < guessesLeft ? 'heart-active' : 'heart-inactive'}>♥</span>
                        ))}
                    </div>
                </div>
                <div className="clues-area">
                    {renderClues()}
                </div>
                
                <div className="input-bar-container">
                    <input className="input-bar" value={inputValue} readOnly />
                </div>
                <div className="keypad">
                    {'123456789'.split('').map(key => <button key={key} className="keypad-button" disabled={isComplete} onClick={() => setInputValue(v => v.length < 3 ? v + key : v)}>{key}</button>)}
                    <button className="keypad-button" disabled={isComplete} onClick={() => setInputValue(v => v.length < 3 ? v + '0' : v)}>0</button>
                    <button className="keypad-button" disabled={isComplete} onClick={() => setInputValue(v => v.slice(0, -1))}>⌫</button>
                    <button className="submit-button" disabled={isComplete} onClick={handleSubmit}>➤</button>
                </div>
                
                {isPractice && isComplete && !showSolution && (
                    <div className="reveal-solution-area">
                        <button className="button reveal-button" onClick={() => setShowSolution(true)}>
                            Reveal Solution
                        </button>
                    </div>
                )}
                
                {showSolution && puzzle && puzzle.values && (
                     <div className="solution-key-container-horizontal">
                          <h3 className="solution-key-title">Solution Key</h3>
                          <div className="solution-key-grid">
                              {Object.entries(puzzle.values)
                                  .filter(([glyph]) => glyph !== questionGlyph)
                                  .map(([glyph, value]) => (
                                  <div key={glyph} className="solution-key-item">
                                      <span className="solution-glyph">{glyph}</span> = <Spoiler value={value} />
                                  </div>
                              ))}
                          </div>
                     </div>
                )}
                
            </div>
            {showResultsPopup && (
                <ResultsScreen 
                    isWin={isWin} 
                    time={elapsedTime}
                    guessHistory={guessHistory} 
                    onPlayAgain={onPlayAgain} 
                    isPractice={isPractice} 
                    onClose={() => setShowResultsPopup(false)}
                    handleShare={handleShare}
                />
            )}
        </>
    );
};

export default Game;