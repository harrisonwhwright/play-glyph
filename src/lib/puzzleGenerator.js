function seededRandom(seed) {
    let s = seed;
    return function() {
        s = Math.sin(s) * 10000;
        return s - Math.floor(s);
    };
}

function getWeightedRandomSize(min, max, random) {
    const range = [];
    for (let i = min; i <= max; i++) {
        const weight = (i - min + 1) * (max - i + 1);
        for (let j = 0; j < weight; j++) {
            range.push(i);
        }
    }
    return range[Math.floor(random() * range.length)];
}

export function generatePuzzle(seed, difficultyRange = null, easyMode = false) {
    const random = seededRandom(seed);
    const glyphs = ['■', '●', '▲', '◆', '★', '⬟', '✦', '✧', '◈'].sort(() => random() - 0.5);
    const numbers = Array.from({ length: 20 }, (_, i) => i + 2).sort(() => random() - 0.5);

    let size;
    if (difficultyRange) {
        size = getWeightedRandomSize(difficultyRange.min, difficultyRange.max, random);
    } else {
        size = 4 + Math.floor(random() * 2);
    }

    const selectedGlyphs = glyphs.slice(0, size);
    const values = {};
    selectedGlyphs.forEach(g => {
        values[g] = numbers.pop();
    });

    const clues = [];
    const questionGlyph = selectedGlyphs[0];
    const solvePath = [...selectedGlyphs];
    let knownGlyphs = new Set();
    let complexityBudget = easyMode ? 0 : (size > 5 ? 2 : 1);

    // build clues backwards from the end of the solve path to guarantee solvability
    for (let i = solvePath.length - 1; i >= 0; i--) {
        const glyphToSolve = solvePath[i];
        let vSolve = values[glyphToSolve];

        if (knownGlyphs.size === 0) {
            clues.push(`${glyphToSolve} × ${glyphToSolve} = ${vSolve * vSolve}`);
        } else {
            const knownGlyphsArray = Array.from(knownGlyphs);
            const canDoComplex = complexityBudget > 0 && !easyMode;
            
            const useTwoDeps = knownGlyphsArray.length >= 2 && canDoComplex && random() > 0.3;

            if (useTwoDeps) {
                const [dep1, dep2] = knownGlyphsArray.sort(() => random() - 0.5).slice(0, 2);
                const vDep1 = values[dep1];
                const vDep2 = values[dep2];
                const m1 = 2 + Math.floor(random() * 2);
                const m2 = 2 + Math.floor(random() * 2);

                const new_vSolve = m1 * vDep1 + m2 * vDep2;
                if (new_vSolve < 150 && !Object.values(values).includes(new_vSolve)) {
                    values[glyphToSolve] = new_vSolve;
                    clues.push(`(${m1} × ${dep1}) + (${m2} × ${dep2}) = ${glyphToSolve}`);
                } else {
                     clues.push(`${dep1} + ${dep2} + ${glyphToSolve} = ${vDep1 + vDep2 + vSolve}`);
                }
                complexityBudget--;

            } else {
                const dep = knownGlyphsArray[Math.floor(random() * knownGlyphsArray.length)];
                const vDep = values[dep];
                const m = 2 + Math.floor(random() * 2);

                if (canDoComplex && random() > 0.4) {
                    const roll = random();
                    if (roll < 0.33) {
                        clues.push(random() > 0.5 ? `(${m} × ${glyphToSolve}) + ${dep} = ${m * vSolve + vDep}` : `${dep} + (${m} × ${glyphToSolve}) = ${vDep + m * vSolve}`);
                    } else if (roll < 0.66) {
                        clues.push(`(${m} × ${glyphToSolve}) = ${m * vSolve + vDep} - ${dep}`);
                    } else {
                        clues.push(`${m * vSolve + vDep} - ${dep} = (${m} × ${glyphToSolve})`);
                    }
                    complexityBudget--;
                } else {
                    clues.push(`${glyphToSolve} + ${dep} = ${vSolve + vDep}`);
                }
            }
        }
        knownGlyphs.add(glyphToSolve);
    }

    clues.sort(() => random() - 0.5);
    
    const finalSolution = values[questionGlyph];

    return {
        puzzle_id: seed,
        clues: [...clues, `${questionGlyph} = ?`],
        solution: finalSolution,
        values: values,
    };
}
