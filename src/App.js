import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from './lib/supabaseClient';
import { generatePuzzle } from './lib/puzzleGenerator';
import WelcomeScreen from './components/WelcomeScreen';
import Game from './components/Game';
import SettingsModal from './components/SettingsModal';
import Footer from './components/Footer';
import './App.css';

// the root component manages auth settings and which screen to show
const App = () => {
    const [session, setSession] = useState(null);
    const [userState, setUserState] = useState('loading');
    const [mode, setMode] = useState('daily');
    const [practiceGameTrigger, setPracticeGameTrigger] = useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    
    // daily game state is now managed here to preserve it across mode switches
    const [dailyState, setDailyState] = useState({
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

    // handles theme changes and saves to local storage
    useEffect(() => {
        document.body.className = theme;
        localStorage.setItem('theme', theme);
    }, [theme]);

    // checks user session on load and listens for auth changes
    useEffect(() => {
        const setAuthAndLoadGame = async (currentSession) => {
            const today = new Date().toISOString().slice(0, 10);
            const dailySeed = parseInt(today.replace(/-/g, ''));
            const dailyPuzzle = generatePuzzle(dailySeed);

            let completedPlay = null;
            const userId = currentSession?.user?.id;

            if (userId) {
                // check if the signed-in user has already played today
                const { data: existingPlay } = await supabase
                    .from('plays')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('puzzle_id', dailySeed)
                    .single();
                if (existingPlay) {
                    completedPlay = existingPlay;
                }
            } else {
                const guestPlay = localStorage.getItem(`glyph-play-${today}`);
                if (guestPlay) {
                    completedPlay = JSON.parse(guestPlay);
                }
            }
            
            // set user state before setting daily state
            setSession(currentSession);
            if (currentSession) {
                setUserState('authenticated');
            } else {
                setUserState(completedPlay ? 'guest' : 'guest_prompt');
            }

            if (completedPlay) {
                const history = completedPlay.guess_history || [];
                setDailyState({
                    puzzle: dailyPuzzle,
                    isComplete: true,
                    isWin: completedPlay.is_win,
                    guessHistory: history,
                    elapsedTime: Math.floor(completedPlay.duration_ms / 1000),
                    guessesLeft: 3 - history.length,
                    isTimerRunning: false,
                });
            } else {
                const inProgressKey = userId ? `glyph-in-progress-${userId}-${today}` : `glyph-in-progress-${today}`;
                const inProgressPlay = JSON.parse(localStorage.getItem(inProgressKey));

                if (inProgressPlay) {
                     setDailyState(inProgressPlay);
                } else {
                     setDailyState({
                        puzzle: dailyPuzzle,
                        elapsedTime: 0,
                        isComplete: false,
                        isWin: false,
                        guessesLeft: 3,
                        guessHistory: [],
                        isTimerRunning: true,
                    });
                }
            }
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            setAuthAndLoadGame(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setAuthAndLoadGame(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    // handles the daily timer and saves progress
    useEffect(() => {
        let interval;
        const today = new Date().toISOString().slice(0, 10);
        const userId = session?.user?.id;

        if (mode === 'daily' && dailyState.isTimerRunning && !dailyState.isComplete) {
            interval = setInterval(() => {
                setDailyState(s => {
                    const newState = { ...s, elapsedTime: s.elapsedTime + 1 };
                    const inProgressKey = userId ? `glyph-in-progress-${userId}-${today}` : `glyph-in-progress-${today}`;
                    localStorage.setItem(inProgressKey, JSON.stringify(newState));
                    return newState;
                });
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [mode, dailyState.isTimerRunning, dailyState.isComplete, session, userState]);
    
    // signs the user out
    const handleSignOut = async () => {
        await supabase.auth.signOut();
        setIsSettingsOpen(false);
    };

    // signs the user in via google
    const handleSignIn = async () => {
        await supabase.auth.signInWithOAuth({ provider: 'google' });
        setIsSettingsOpen(false);
    };

    // toggles light and dark mode
    const handleThemeChange = () => {
        setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
    };
    
    // handles the minimum difficulty dropdown
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

    // handles the maximum difficulty dropdown
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
    
    // handles the easy mode toggle
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

    // starts a new practice game
    const handleNewPracticeGame = useCallback(() => {
        setPracticeGameTrigger(t => t + 1);
    }, []);
    
    // memoizes the difficulty range to prevent unnecessary game resets
    const practiceDifficultyRange = useMemo(() => ({
        min: minPracticeDifficulty,
        max: maxPracticeDifficulty
    }), [minPracticeDifficulty, maxPracticeDifficulty]);

    // pauses or resumes the daily timer when switching modes
    const handleModeChange = (newMode) => {
        if (mode === 'daily' && newMode === 'practice') {
            setDailyState(s => ({ ...s, isTimerRunning: false }));
        }
        if (mode === 'practice' && newMode === 'daily' && !dailyState.isComplete) {
            setDailyState(s => ({ ...s, isTimerRunning: true }));
        }
        setMode(newMode);
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <h1 className="app-title">Play-Glyph</h1>
                <div className="controls-container">
                    <div className="mode-switcher">
                        <button className={`mode-button ${mode === 'daily' ? 'active' : ''}`} onClick={() => handleModeChange('daily')}>Daily</button>
                        <button className={`mode-button ${mode === 'practice' ? 'active' : ''}`} onClick={() => { handleModeChange('practice'); handleNewPracticeGame(); }}>Practice</button>
                    </div>
                    {userState !== 'authenticated' && (
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
                {userState === 'loading' && <div>Loading...</div>}
                {userState === 'guest_prompt' && <WelcomeScreen onGuestLogin={() => setUserState('guest')} />}
                {(userState === 'guest' || userState === 'authenticated') && (
                     <>
                        {mode === 'daily' ? (
                             <Game 
                                key={'daily'} 
                                user={session?.user} 
                                isPractice={false} 
                                dailyState={dailyState}
                                setDailyState={setDailyState}
                            />
                        ) : (
                             <Game 
                                key={`practice-${practiceGameTrigger}`}
                                user={session?.user} 
                                isPractice={true} 
                                onPlayAgain={handleNewPracticeGame}
                                practiceDifficultyRange={practiceDifficultyRange}
                                easyMode={easyMode}
                            />
                        )}
                     </>
                )}
            </main>
            <SettingsModal 
                isOpen={isSettingsOpen} 
                onClose={() => setIsSettingsOpen(false)} 
                onSignOut={handleSignOut}
                onSignIn={handleSignIn}
                userState={userState}
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