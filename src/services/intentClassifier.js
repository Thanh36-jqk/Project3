const dataset = require('../ml/intents/dataset');

// Generic connector words that appear across every intent and carry no
// discriminative signal — left in, they let whichever class has the most
// training examples dominate ambiguous messages (observed empirically:
// adding warranty examples skewed unrelated messages toward bao_hanh).
const STOPWORDS = new Set([
    'co', 'có', 'khong', 'không', 'duoc', 'được', 'la', 'là', 'gi', 'gì',
    'vay', 'vậy', 'thi', 'thì', 'the', 'thế', 'nao', 'nào', 'cua', 'của',
    'va', 'và', 'a', 'ạ', 'nhe', 'nhé',
]);

function tokenize(text) {
    const words = text.toLowerCase().match(/\p{L}+/gu) || [];
    return words.filter(w => !STOPWORDS.has(w));
}

// Multinomial Naive Bayes with Laplace smoothing.
function trainNaiveBayes(examples) {
    const classCounts = {};
    const wordCounts = {};
    const classWordTotals = {};
    const vocab = new Set();

    for (const { text, intent } of examples) {
        classCounts[intent] = (classCounts[intent] || 0) + 1;
        wordCounts[intent] = wordCounts[intent] || {};
        classWordTotals[intent] = classWordTotals[intent] || 0;
        for (const word of tokenize(text)) {
            vocab.add(word);
            wordCounts[intent][word] = (wordCounts[intent][word] || 0) + 1;
            classWordTotals[intent]++;
        }
    }

    return {
        classCounts,
        wordCounts,
        classWordTotals,
        vocabSize: vocab.size,
        totalDocs: examples.length,
    };
}

// Predicts intent + confidence (softmax-normalized log-likelihood) for one message.
function predict(model, text) {
    const { classCounts, wordCounts, classWordTotals, vocabSize, totalDocs } = model;
    const words = tokenize(text);
    const classes = Object.keys(classCounts);

    const scores = {};
    for (const cls of classes) {
        let score = Math.log(classCounts[cls] / totalDocs);
        const totalWords = classWordTotals[cls];
        for (const word of words) {
            const count = (wordCounts[cls][word] || 0) + 1;
            score += Math.log(count / (totalWords + vocabSize));
        }
        scores[cls] = score;
    }

    const maxScore = Math.max(...Object.values(scores));
    let sumExp = 0;
    const expScores = {};
    for (const cls of classes) {
        expScores[cls] = Math.exp(scores[cls] - maxScore);
        sumExp += expScores[cls];
    }

    let bestIntent = classes[0];
    let bestConfidence = -Infinity;
    for (const cls of classes) {
        const confidence = expScores[cls] / sumExp;
        if (confidence > bestConfidence) {
            bestConfidence = confidence;
            bestIntent = cls;
        }
    }

    return { intent: bestIntent, confidence: bestConfidence };
}

const model = trainNaiveBayes(dataset);

function classify(text) {
    return predict(model, text);
}

module.exports = { classify, trainNaiveBayes, predict, tokenize };
