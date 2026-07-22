const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, 'Frontend', 'src', 'pages', 'dashboards', 'TaskReviewPage.tsx');
let content = fs.readFileSync(file, 'utf8');

// Replace \`${ with `${
content = content.replace(/\\`\\\${/g, '`${');
// Replace \` with `
content = content.replace(/\\`/g, '`');

fs.writeFileSync(file, content);
console.log('Fixed TaskReviewPage.tsx syntax errors');
