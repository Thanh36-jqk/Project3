const fs = require('fs');
const path = require('path');
const dir = 'c:/Users/nthan/Project3/public';

const walk = (dir) => {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        file = dir + '/' + file;
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.html') || file.endsWith('.js')) results.push(file);
        }
    });
    return results;
};

const files = walk(dir);
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    content = content.replace(/const API_BASE_URL = '';/g, "const API_BASE_URL = 'https://project3-icy1.onrender.com';");
    content = content.replace(/const API_URL = '';/g, "const API_URL = 'https://project3-icy1.onrender.com';");
    content = content.replace(/const API_URL = '\/api';/g, "const API_URL = 'https://project3-icy1.onrender.com/api';");
    content = content.replace(/fetch\('\/api\//g, "fetch('https://project3-icy1.onrender.com/api/");
    content = content.replace(/href="\/auth\/google"/g, 'href="https://project3-icy1.onrender.com/auth/google"');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated:', file);
    }
});
console.log('Done replacing URLs');
