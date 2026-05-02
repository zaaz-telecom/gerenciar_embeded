import { welcomeEmailTemplate } from './src/lib/email-templates.js';

// Simulando o ambiente para teste
process.env.PUBLIC_SITE_URL = 'https://mis.online.net.br';

const html = welcomeEmailTemplate('Teste Usuário');
console.log('--- HTML GERADO ---');
console.log(html);
console.log('--- FIM ---');
