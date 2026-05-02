import { welcomeWithPasswordResetTemplate, passwordResetEmailTemplate } from './src/lib/email-templates.js';

const welcomeHtml = welcomeWithPasswordResetTemplate('{{nome}}', '{{reset_url}}');
const resetHtml = passwordResetEmailTemplate('{{reset_url}}');

console.log('--- WELCOME TEMPLATE ---');
console.log(JSON.stringify(welcomeHtml));
console.log('\n--- RESET TEMPLATE ---');
console.log(JSON.stringify(resetHtml));
