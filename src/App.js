import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { generatePuzzle } from './lib/puzzleGenerator';
import WelcomeScreen from './components/WelcomeScreen';
import SettingsModal from './components/SettingsModal';
import Game from './components/Game';
import Footer from './components/Footer';
import './App.css';

const App = () => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mode, setMode] = useState('daily');
    const [practiceGameTrigger, setPracticeGameTrigger] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [guestHasStarted, setGuestHasStarted] = useState(false);
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
    
    const [gameState, setGameState] = useState({
        puzzle: null,
        elapsedTime: 0,
        isComplete: false,
        isWin: false,
        guessesLeft: 3,
        guessHistory: [],
        isTimerRunning: false,
    });
    
    const [minPracticeDifficulty, setMinPracticeDifficulty] = useState(() => parseInt(localStorage.getItem('minDifficulty') || '3', 10));
    const [maxPracticeDifficulty, setMaxPracticeDifficulty] = useState(() => parseInt(localStorage.getItem('maxDifficulty') || '5', 10));
    const [easyMode, setEasyMode] = useState(() => localStorage.getItem('easyMode') === 'true');
    const [lastCustomDifficulty, setLastCustomDifficulty] = useState({ 
        min: parseInt(localStorage.getItem('lastCustomMin') || '4', 10), 
        max: parseInt(localStorage.getItem('lastCustomMax') || '8', 10) 
    });

    useEffect(() => {
        document.body.className = theme;
        localStorage.setItem('theme', theme);
    }, [theme]);
    
    useEffect(() => {
        const initializeDailyState = async (currentSession) => {
            setLoading(true);
            
            const now = new Date();
            const year = now.getUTCFullYear();
            const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
            const day = now.getUTCDate().toString().padStart(2, '0');
            const utcDateStr = `${year}-${month}-${day}`;
            const dailySeed = parseInt(`${year}${month}${day}`, 10);
            
            let dailyPuzzle;

            const { data: dbPuzzle, error: dbPuzzleError } = await supabase
                .from('puzzles')
                .select('*')
                .eq('puzzle_id', dailySeed)
                .single();

            if (dbPuzzleError && dbPuzzleError.code !== 'PGRST116') {
                console.error("Error fetching daily puzzle from DB:", dbPuzzleError);
            }

            if (dbPuzzle) {
                dailyPuzzle = {
                    puzzle_id: dbPuzzle.puzzle_id,
                    clues: dbPuzzle.clues,
                    solution: dbPuzzle.solution,
                    values: dbPuzzle.values, // <-- THE FIX IS HERE
                };
            } else {
                console.warn(`Puzzle with ID ${dailySeed} not found in database. Using client-side generation as a fallback.`);
                dailyPuzzle = generatePuzzle(dailySeed);
            }
            
            let completedPlay = null;

            if (currentSession?.user) {
                const { data, error } = await supabase
                    .from('plays')
                    .select('*')
                    .eq('user_id', currentSession.user.id)
                    .eq('puzzle_id', dailySeed)
                    .limit(1)
                    .maybeSingle();
                
                if (error) {
                    console.error("Error fetching play record:", error);
                } else {
                    completedPlay = data;
                }

            } else {
                const guestPlay = localStorage.getItem(`glyph-play-${utcDateStr}`);
                if (guestPlay) {
                    completedPlay = JSON.parse(guestPlay);
                }
            }
            
            if (completedPlay) {
                const history = completedPlay.guess_history || [];
                
                let finalGuessesLeft = 0;
                if (completedPlay.is_win) {
                    const wrongGuesses = history.length - 1;
                    finalGuessesLeft = 3 - wrongGuesses;
                }

                setGameState({
                    puzzle: dailyPuzzle,
                    isComplete: true,
                    isWin: completedPlay.is_win,
                    guessHistory: history,
                    elapsedTime: Math.floor(completedPlay.duration_ms / 1000),
                    guessesLeft: finalGuessesLeft,
                    isTimerRunning: false,
                });
            } else {
                setGameState({
                    puzzle: dailyPuzzle,
                    elapsedTime: 0,
                    isComplete: false,
                    isWin: false,
                    guessesLeft: 3,
                    guessHistory: [],
                    isTimerRunning: true,
                });
            }
            setLoading(false);
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            initializeDailyState(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        let interval;
        if (gameState.isTimerRunning && !gameState.isComplete) {
            interval = setInterval(() => {
                setGameState(s => ({ ...s, elapsedTime: s.elapsedTime + 1 }));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [gameState.isTimerRunning, gameState.isComplete]);
    
    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setIsSettingsOpen(false);
    };

    const handleSignIn = async () => {
        await supabase.auth.signInWithOAuth({ provider: 'google' });
        setIsSettingsOpen(false);
    };

    const handleThemeChange = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };
    
    const handleMinDifficultyChange = (e) => {
        const newMin = parseInt(e.target.value, 10);
        setLastCustomDifficulty(prev => ({ ...prev, min: newMin }));
        setMinPracticeDifficulty(newMin);
        localStorage.setItem('minDifficulty', newMin);
        if (newMin > maxPracticeDifficulty) {
            setMaxPracticeDifficulty(newMin);
            localStorage.setItem('maxDifficulty', newMin);
        }
    };

    const handleMaxDifficultyChange = (e) => {
        const newMax = parseInt(e.target.value, 10);
        setLastCustomDifficulty(prev => ({ ...prev, max: newMax }));
        setMaxPracticeDifficulty(newMax);
        localStorage.setItem('maxDifficulty', newMax);
        if (newMax < minPracticeDifficulty) {
            setMinPracticeDifficulty(newMax);
            localStorage.setItem('minDifficulty', newMax);
        }
    };
    
    const handleEasyModeChange = () => {
        const newEasyMode = !easyMode;
        setEasyMode(newEasyMode);
        localStorage.setItem('easyMode', newEasyMode);

        if (newEasyMode) {
            setLastCustomDifficulty({ min: minPracticeDifficulty, max: maxPracticeDifficulty });
            localStorage.setItem('lastCustomMin', minPracticeDifficulty);
            localStorage.setItem('lastCustomMax', maxPracticeDifficulty);
            setMinPracticeDifficulty(3);
            setMaxPracticeDifficulty(5);
        } else {
            setMinPracticeDifficulty(lastCustomDifficulty.min);
            setMaxPracticeDifficulty(lastCustomDifficulty.max);
        }
    };

    const handleNewPracticeGame = useCallback(() => {
        setPracticeGameTrigger(t => t + 1);
    }, []);
    
    const practiceDifficultyRange = useMemo(() => ({
        min: minPracticeDifficulty,
        max: maxPracticeDifficulty
    }), [minPracticeDifficulty, maxPracticeDifficulty]);

    const renderContent = () => {
        if (loading) {
            return <div>Loading...</div>;
        }

        if (mode === 'daily') {
            if (!session && !gameState.isComplete && !guestHasStarted) {
                return <WelcomeScreen onGuestLogin={() => setGuestHasStarted(true)} />;
            }
            return (
                <Game 
                    key='daily'
                    user={session?.user} 
                    isPractice={false} 
                    dailyState={gameState}
                    setDailyState={setGameState}
                />
            );
        }
        
        if (mode === 'practice') {
            return (
                <Game 
                    key={practiceGameTrigger}
                    user={session?.user} 
                    isPractice={true} 
                    onPlayAgain={handleNewPracticeGame}
                    practiceDifficultyRange={practiceDifficultyRange}
                    easyMode={easyMode}
                />
            );
        }
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <h1 className="app-title">Play-Glyph</h1>
                <div className="controls-container">
                    <div className="mode-switcher">
                        <button className={`mode-button ${mode === 'daily' ? 'active' : ''}`} onClick={() => setMode('daily')}>Daily</button>
                        <button className={`mode-button ${mode === 'practice' ? 'active' : ''}`} onClick={() => { setMode('practice'); handleNewPracticeGame(); }}>Practice</button>
                    </div>
                    {!session && (
                        <button onClick={handleSignIn} className="auth-button google-signin-button">
                            <svg viewBox="0 0 48 48" width="20px" height="20px"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path><path fill="none" d="M0 0h48v48H0z"></path></svg>
                            <span>Sign In</span>
                        </button>
                    )}
                    <button onClick={() => setIsSettingsOpen(true)} className="auth-button">
                        Settings
                    </button>
                </div>
            </header>
            <main>
                {renderContent()}
            </main>
            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                onSignOut={handleSignOut}
                onSignIn={handleSignIn}
                userState={session ? 'authenticated' : (guestHasStarted || gameState.isComplete ? 'guest' : 'guest_prompt')}
                theme={theme}
                onThemeChange={handleThemeChange}
                minDifficulty={minPracticeDifficulty}
                maxDifficulty={maxPracticeDifficulty}
                onMinDifficultyChange={handleMinDifficultyChange}
                onMaxDifficultyChange={handleMaxDifficultyChange}
                easyMode={easyMode}
                onEasyModeChange={handleEasyModeChange}
            />
            <Footer />
        </div>
    );
};

export default App;