import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { generatePuzzle } from '../lib/puzzleGenerator';
import ResultsScreen from './ResultsScreen';

// a clickable black box that hides the answer
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

// the main game component
const Game = ({ user, isPractice, onPlayAgain, practiceDifficultyRange, easyMode, dailyState, setDailyState }) => {
    // practice mode uses its own internal state
    const [practicePuzzle, setPracticePuzzle] = useState(null);
    const [practiceElapsedTime, setPracticeElapsedTime] = useState(0);
    const [practiceIsComplete, setPracticeIsComplete] = useState(false);
    const [practiceIsWin, setPracticeIsWin] = useState(false);
    const [practiceGuessesLeft, setPracticeGuessesLeft] = useState(3);
    const [practiceGuessHistory, setPracticeGuessHistory] = useState([]);
    const [practiceIsTimerRunning, setPracticeIsTimerRunning] = useState(false);

    // shared state for both modes
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(true);
    const [showResultsPopup, setShowResultsPopup] = useState(false);
    const [showSolution, setShowSolution] = useState(false);

    // determine which state to use based on the current mode
    const isDaily = !isPractice;
    const puzzle = isDaily ? dailyState.puzzle : practicePuzzle;
    const elapsedTime = isDaily ? dailyState.elapsedTime : practiceElapsedTime;
    const isComplete = isDaily ? dailyState.isComplete : practiceIsComplete;
    const isWin = isDaily ? dailyState.isWin : practiceIsWin;
    const guessesLeft = isDaily ? dailyState.guessesLeft : practiceGuessesLeft;
    const guessHistory = isDaily ? dailyState.guessHistory : practiceGuessHistory;

    // formats the text for the share button
    const shareText = useMemo(() => {
        if (!puzzle) return '';
        const seedStr = puzzle.puzzle_id.toString();
        const year = seedStr.substring(2, 4);
        const month = seedStr.substring(4, 6);
        const day = seedStr.substring(6, 8);
        const formattedDate = `${day}.${month}.${year}`;
        const score = isWin ? `${guessHistory.length}/3` : 'X/3';
        const resultSquares = guessHistory.map(g => g === puzzle.solution ? '🟩' : '⬛').join('');
        
        return `#playglyph (${formattedDate}) ${score} ${resultSquares} https://play-glyph.com`;
    }, [puzzle, isWin, guessHistory]);

    // copies share text to the clipboard
    const handleShare = useCallback(() => {
        navigator.clipboard.writeText(shareText).then(() => {
            alert("Results copied to clipboard!");
        }).catch(err => console.error('Failed to copy', err));
    }, [shareText]);

    // handles all logic when the game ends
    const endGame = useCallback((winState, finalHistory) => {
        if (isDaily) {
            setDailyState(s => ({ ...s, isTimerRunning: false, isComplete: true, isWin: winState }));
        } else {
            setPracticeIsTimerRunning(false);
            setPracticeIsComplete(true);
            setPracticeIsWin(winState);
        }
        setShowResultsPopup(true);

        if (isPractice) {
            if (user && winState) {
                supabase.rpc('increment_practice_wins', { p_user_id: user.id }).then();
            }
        } else {
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
                localStorage.setItem(`glyph-play-${new Date().toISOString().slice(0, 10)}`, JSON.stringify(playData));
            }
        }
    }, [puzzle, elapsedTime, user, isPractice, isDaily, setDailyState]);

    // handles a user's guess submission
    const handleSubmit = useCallback(() => {
        if (isComplete || !inputValue || guessesLeft === 0) return;

        const currentGuess = parseInt(inputValue);
        const newHistory = [...guessHistory, currentGuess];
        const solved = currentGuess === puzzle.solution;

        if (solved) {
            if (isDaily) setDailyState(s => ({ ...s, guessHistory: newHistory }));
            else setPracticeGuessHistory(newHistory);
            setInputValue('');
            endGame(true, newHistory);
        } else {
            const newGuessesLeft = guessesLeft - 1;
            if (isDaily) setDailyState(s => ({ ...s, guessHistory: newHistory, guessesLeft: newGuessesLeft }));
            else {
                setPracticeGuessHistory(newHistory);
                setPracticeGuessesLeft(newGuessesLeft);
            }
            setInputValue('');
            if (newGuessesLeft === 0) {
                endGame(false, newHistory);
            }
        }
    }, [isComplete, inputValue, guessesLeft, puzzle, endGame, guessHistory, isDaily, setDailyState]);

    // sets up a practice game
    useEffect(() => {
        if (!isPractice) return;
        setLoading(true);
        const puzzleSeed = Date.now();
        const currentPuzzle = generatePuzzle(puzzleSeed, practiceDifficultyRange, easyMode);
        setPracticePuzzle(currentPuzzle);
        setPracticeElapsedTime(0);
        setPracticeIsTimerRunning(true);
        setPracticeGuessesLeft(3);
        setPracticeGuessHistory([]);
        setInputValue('');
        setPracticeIsComplete(false);
        setShowResultsPopup(false);
        setShowSolution(false);
        setLoading(false);
    }, [isPractice, onPlayAgain, practiceDifficultyRange, easyMode]);
    
    // handles the practice timer
    useEffect(() => {
        let interval;
        if (isPractice && practiceIsTimerRunning) {
            interval = setInterval(() => {
                setPracticeElapsedTime(prevTime => prevTime + 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isPractice, practiceIsTimerRunning]);

    // handles physical keyboard input
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
    
    // renders clues highlighting the answer on a win
    const renderClues = () => {
        if (!puzzle) return null;
        return puzzle.clues.map((clue, index) => {
            const isQuestion = index === puzzle.clues.length - 1;
            if (isQuestion && isComplete && isWin) {
                return <div key={index} className="clue-solved">{clue.replace('?', puzzle.solution)}</div>;
            }
            return <div key={index}>{clue}</div>;
        });
    };
    
    // this effect ensures the UI correctly reflects the loaded daily state
    useEffect(() => {
        if(isDaily) {
            setLoading(!dailyState.puzzle);
            if(dailyState.isComplete) {
                setShowResultsPopup(true);
            }
        }
    }, [isDaily, dailyState]);


    if (loading || !puzzle) return <div className="game-container">Loading puzzle...</div>;
    
    const questionGlyph = puzzle.clues[puzzle.clues.length - 1].split(' ')[0];

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
                
                {isComplete && !showSolution && (
                    <div className="reveal-solution-area">
                        <button className="button reveal-button" onClick={() => setShowSolution(true)}>
                            Reveal Solution
                        </button>
                    </div>
                )}
                
                {showSolution && puzzle && (
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