const crypto = require('crypto');
const fs = require('fs').promises;

function getSecureInput(prompt) {
    return new Promise(resolve => {
        process.stdout.write(prompt + ' ');
        let input = '';
        
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf-8');
        
        // This function control the security of the input of your cookie and secret key.
        const onData = (char) => {
            char = char.toString();
            
            if (char === '\u0003') {
                process.stdin.setRawMode(false);
                process.stdin.removeListener('data', onData);
                process.stdin.pause();
                process.stdout.write('\n');
                process.exit();
            }
            
            if (char === '\r' || char === '\n') {
                process.stdin.setRawMode(false);
                process.stdin.removeListener('data', onData);
                process.stdin.pause();
                process.stdout.write('\n');
                resolve(input);
                return;
            }
            
            // Backspace
            if (char === '\u0008' || char === '\u007f') {
                input = input.slice(0, -1);
                return;
            }
            
            // Add character to input
            input += char;
        };
        
        process.stdin.on('data', onData);
    });
}

async function encryptCookie() {
    try {
        const cookie = await getSecureInput('Enter your .ROBLOSECURITY cookie (Output is hidden):');
        const secretKey = await getSecureInput('Enter a secret key (Output is hidden, must be at least 32 characters):');

        if (secretKey.length < 32) {
            console.log('\nSecret key must be at least 32 characters for AES-256.');
            return;
        }

        const iv = crypto.randomBytes(16);

        // Create cipher with the key (truncate or pad to 32 bytes for AES-256)
        const key = Buffer.from(secretKey.padEnd(32, ' ').slice(0, 32));
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

        let encrypted = cipher.update(cookie, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const encryptedData = iv.toString('hex') + ':' + encrypted;

        await fs.writeFile('cookie.enc', encryptedData, 'utf8');
        console.log('\nCookie encrypted and saved to cookie.enc, keep your secret key safe!');

    } catch (error) {
        console.error('\nError encrypting cookie:', error.message);
    }
}

encryptCookie();
