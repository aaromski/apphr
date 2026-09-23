const fs = require('fs');

const content = fs.readFileSync('app/recepcionista/page.tsx', 'utf8');

// Replace className="..." with className={c(`...`)} for strings containing /
// More comprehensive regex
let result = content.replace(/className="([^"]*\/[^"]*)"/g, (match, p1) => {
  return 'className={c(`' + p1 + '`)}';
});

// Also handle className={`...`} with template literals
result = result.replace(/className={`([^`]*\/[^`]*)`}/g, (match, p1) => {
  return 'className={c(`' + p1 + '`)}';
});

// Also handle className={`...`} with template literals containing /
result = result.replace(/className={`([^`]*\/[^`]*)`}/g, (match, p1) => {
  return 'className={c(`' + p1 + '`)}';
});

// Also handle className={`...`} with template literals containing /
result = result.replace(/className=\{`([^`]*\/[^`]*)`\}/g, (match, p1) => {
  return 'className={c(`' + p1 + '`)}';
});

require('fs').writeFileSync('app/recepcionista/page.tsx', result);
console.log('Done');