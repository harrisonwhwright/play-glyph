import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { generatePuzzle } from './lib/puzzleGenerator';
import Game from './components/Game';

const App = () => {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);
    const [dailyState, setDailyState] = useState({
        puzzle: null,
        elapsedTime: 0,
        isComplete: false,
        isWin: false,
        guessesLeft: 3,
        guessHistory: [],
        isTimerRunning: false,
    });

    useEffect(() => {
        const fetchSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            setSession(session);
            
            const { data: authListener } = supabase.auth.onAuthStateChange(
                (_event, session) => {
                    setSession(session);
                    setLoading(false);
                }
            );

            if (!session) {
                setLoading(false);
            }

            return () => {
                authListener.subscription.unsubscribe();
            };
        };
        fetchSession();
    }, []);

    useEffect(() => {
        if (loading) {
            return;
        }

        const initializeDailyGame = async () => {
            const today = new Date();
            const todayStr = today.toISOString().slice(0, 10);
            const todayPuzzleId = parseInt(`10${today.toISOString().slice(2, 10).replace(/-/g, '')}`);
            const puzzle = generatePuzzle(todayPuzzleId);
            
            const user = session?.user;
            let existingPlay = null;

            if (user) {
                const { data } = await supabase
                    .from('plays')
                    .select('*')
                    .eq('user_id', user.id)
                    .eq('puzzle_id', todayPuzzleId)
                    .single();

                if (data) {
                    existingPlay = {
                        is_win: data.is_win,
                        duration_ms: data.duration_ms,
                        guess_history: data.guess_history,
                    };
                }
            } else {
                const localData = localStorage.getItem(`glyph-play-${todayStr}`);
                if (localData) {
                    existingPlay = JSON.parse(localData);
                }
            }

            if (existingPlay) {
                setDailyState({
                    puzzle: puzzle,
                    isComplete: true,
                    isWin: existingPlay.is_win,
                    elapsedTime: Math.floor(existingPlay.duration_ms / 1000),
                    guessHistory: existingPlay.guess_history,
                    guessesLeft: 3 - (existingPlay.guess_history?.length || 0),
                    isTimerRunning: false,
                });
            } else {
                setDailyState({
                    puzzle: puzzle,
                    isComplete: false,
                    isWin: false,
                    elapsedTime: 0,
                    guessHistory: [],
                    guessesLeft: 3,
                    isTimerRunning: true,
                });
            }
        };

        initializeDailyGame();
    }, [session, loading]);

    if (loading || !dailyState.puzzle) {
        return <div className="game-container">Loading...</div>;
    }

    return (
        <div className="App">
            <Game 
                user={session?.user} 
                isPractice={false} 
                dailyState={dailyState} 
                setDailyState={setDailyState} 
            />
        </div>
    );
};

export default App;