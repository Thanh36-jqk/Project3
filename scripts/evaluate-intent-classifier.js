// Evaluates the FAQ intent classifier with an 80/20 train/test split.
// Reports per-class accuracy and a confusion matrix — for the thesis methodology chapter.
// Run: node scripts/evaluate-intent-classifier.js

const dataset = require('../src/ml/intents/dataset');
const { trainNaiveBayes, predict } = require('../src/services/intentClassifier');

function splitByClass(examples, testRatio = 0.2) {
    const byClass = {};
    for (const ex of examples) {
        byClass[ex.intent] = byClass[ex.intent] || [];
        byClass[ex.intent].push(ex);
    }

    const train = [];
    const test = [];
    for (const intent of Object.keys(byClass)) {
        const items = byClass[intent];
        const testCount = Math.max(1, Math.round(items.length * testRatio));
        test.push(...items.slice(0, testCount));
        train.push(...items.slice(testCount));
    }
    return { train, test };
}

function evaluate() {
    const { train, test } = splitByClass(dataset);
    const model = trainNaiveBayes(train);

    const labels = [...new Set(dataset.map(ex => ex.intent))].sort();
    const confusion = {};
    for (const actual of labels) {
        confusion[actual] = {};
        for (const predicted of labels) confusion[actual][predicted] = 0;
    }

    let correct = 0;
    for (const { text, intent } of test) {
        const { intent: predicted } = predict(model, text);
        confusion[intent][predicted]++;
        if (predicted === intent) correct++;
    }

    const accuracy = correct / test.length;

    console.log(`Train examples: ${train.length}, Test examples: ${test.length}`);
    console.log(`Accuracy: ${(accuracy * 100).toFixed(1)}% (${correct}/${test.length})\n`);

    console.log('Confusion matrix (rows = actual, cols = predicted):');
    const header = ['actual\\pred', ...labels].join('\t');
    console.log(header);
    for (const actual of labels) {
        const row = [actual, ...labels.map(p => confusion[actual][p])].join('\t');
        console.log(row);
    }
}

evaluate();
