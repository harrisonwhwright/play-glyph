import React from 'react';
import { supabase } from './lib/supabaseClient';
import { generatePuzzle } from './lib/puzzleGenerator';
import WelcomeScreen from './components/WelcomeScreen';
import SettingsModal from './components/SettingsModal';
import Game from './components/Game';
import Footer from './components/Footer';
import './App.css';

// the root component manages auth settings and which screen to show
const App = () => {
    const [session, setSession] = React.useState(null);
    const [userState, setUserState] = React.useState('loading');
    const [mode, setMode] = React.useState('daily');
    const [practiceGameTrigger, setPracticeGameTrigger] = React.useState(0);
    const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
    const [theme, setTheme] = React.useState(localStorage.getItem('theme') || 'light');
    
    // holds the state for the currently active game
    const [gameState, setGameState] = React.useState({
        puzzle: null,
        elapsedTime: 0,
        isComplete: false,
        isWin: false,
        guessesLeft: 3,
        guessHistory: [],
        isTimerRunning: false,
    });
    
    const [minPracticeDifficulty, setMinPracticeDifficulty] = React.useState(() => parseInt(localStorage.getItem('minDifficulty') || '3', 10));
    const [maxPracticeDifficulty, setMaxPracticeDifficulty] = React.useState(() => parseInt(localStorage.getItem('maxDifficulty') || '5', 10));
    const [easyMode, setEasyMode] = React.useState(() => localStorage.getItem('easyMode') === 'true');
    const [lastCustomDifficulty, setLastCustomDifficulty] = React.useState({ 
        min: parseInt(localStorage.getItem('lastCustomMin') || '4', 10), 
        max: parseInt(localStorage.getItem('lastCustomMax') || '8', 10) 
    });

    // handles theme changes and saves to local storage
    React.useEffect(() => {
        document.body.className = theme;
        localStorage.setItem('theme', theme);
    }, [theme]);

    // this is the main effect for handling authentication and loading the initial game state
    React.useEffect(() => {
        const initializeApp = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            await loadDailyPuzzle(session);

            const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
                setSession(newSession);
                await loadDailyPuzzle(newSession);
            });

            return () => subscription.unsubscribe();
        };

        initializeApp();
    }, []);

    // loads the daily puzzle checking for completed games
    const loadDailyPuzzle = async (currentSession) => {
        const today = new Date().toISOString().slice(0, 10);
        const dailySeed = parseInt(today.replace(/-/g, ''));
        let completedPlay = null;

        if (currentSession) {
            const { data } = await supabase
                .from('plays')
                .select('*')
                .eq('user_id', currentSession.user.id)
                .eq('puzzle_id', dailySeed)
                .single();
            if (data) completedPlay = data;
        } else {
            const guestPlay = localStorage.getItem(`glyph-play-${today}`);
            if (guestPlay) completedPlay = JSON.parse(guestPlay);
        }
        
        const dailyPuzzle = generatePuzzle(dailySeed);

        if (completedPlay) {
            const history = completedPlay.guess_history || [];
            setGameState({
                puzzle: dailyPuzzle,
                isComplete: true,
                isWin: completedPlay.is_win,
                guessHistory: history,
                elapsedTime: Math.floor(completedPlay.duration_ms / 1000),
                guessesLeft: 3 - history.length,
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
        
        if (currentSession) {
             setUserState('authenticated');
        } else {
             setUserState(completedPlay ? 'guest' : 'guest_prompt');
        }
    };

    // handles the game timer
    React.useEffect(() => {
        let interval;
        if (gameState.isTimerRunning && !gameState.isComplete) {
            interval = setInterval(() => {
                setGameState(s => ({ ...s, elapsedTime: s.elapsedTime + 1 }));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [gameState.isTimerRunning, gameState.isComplete]);
    
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
    const handleNewPracticeGame = React.useCallback(() => {
        setPracticeGameTrigger(t => t + 1);
    }, []);
    
    // memoizes the difficulty range to prevent unnecessary game resets
    const practiceDifficultyRange = React.useMemo(() => ({
        min: minPracticeDifficulty,
        max: maxPracticeDifficulty
    }), [minPracticeDifficulty, maxPracticeDifficulty]);

    return (
        <div className="app-container">
            <header className="app-header">
                <h1 className="app-title">Play-Glyph</h1>
                <div className="controls-container">
                    <div className="mode-switcher">
                        <button className={`mode-button ${mode === 'daily' ? 'active' : ''}`} onClick={() => setMode('daily')}>Daily</button>
                        <button className={`mode-button ${mode === 'practice' ? 'active' : ''}`} onClick={() => { setMode('practice'); handleNewPracticeGame(); }}>Practice</button>
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
                     <Game 
                        key={mode === 'practice' ? practiceGameTrigger : 'daily'} 
                        user={session?.user} 
                        isPractice={mode === 'practice'} 
                        onPlayAgain={handleNewPracticeGame}
                        practiceDifficultyRange={practiceDifficultyRange}
                        easyMode={easyMode}
                        dailyState={gameState}
                        setDailyState={setGameState}
                    />
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