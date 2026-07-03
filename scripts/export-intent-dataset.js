// Exports src/ml/intents/dataset.js to JSON so it can be loaded from Python (Colab/PhoBERT experiments).
// Run: node scripts/export-intent-dataset.js

const fs = require('fs');
const path = require('path');
const dataset = require('../src/ml/intents/dataset');

const outPath = path.join(__dirname, '../src/ml/intents/dataset.json');
fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));
console.log(`Exported ${dataset.length} examples to ${outPath}`);
