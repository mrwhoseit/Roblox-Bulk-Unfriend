const crypto = require('crypto');
const fs = require('fs').promises;
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

async function encryptCookie() {
    try {
        const cookie = await new Promise((resolve) => {
            readline.question('Enter your .ROBLOSECURITY cookie: ', (answer) => resolve(answer.trim()));
        });

        // It has to be 32 characters because of what the encryption method is (Sorry Brandon!)
        const secretKey = await new Promise((resolve) => {
            readline.question('Enter a secret key (at least 32 characters, keep it safe!): ', (answer) => resolve(answer));
        });

        if (secretKey.length < 32) {
            console.log('Secret key must be at least 32 characters for AES-256.');
            readline.close();
            return;
        }

        // This generates a random IV (Similar to a Public and Private key combo)
        const iv = crypto.randomBytes(16);

        // Create cipher with the key (truncate or pad to 32 bytes for AES-256)
        const key = Buffer.from(secretKey.padEnd(32, ' ').slice(0, 32));
        const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

        let encrypted = cipher.update(cookie, 'utf8', 'hex');
        encrypted += cipher.final('hex');

        const encryptedData = iv.toString('hex') + ':' + encrypted;

        await fs.writeFile('cookie.enc', encryptedData, 'utf8');
        console.log('Cookie encrypted and saved to cookie.enc, keep your secret key safe!');

    } catch (error) {
        console.error('Error encrypting cookie:', error.message);
    } finally {
        readline.close();
    }
}

encryptCookie();