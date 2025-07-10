const fs = require('fs').promises;
const crypto = require('crypto');
const readline = require('readline');
const https = require('https');
const path = require('path');
const { browserLogin } = require('./browserAuth');

// HTTP request utility
function makeRequest(options, data = null) {
    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                try {
                    const result = {
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: body
                    };
                    resolve(result);
                } catch (error) {
                    reject(error);
                }
            });
        });

        req.on('error', reject);
        
        if (data) {
            req.write(data);
        }
        
        req.end();
    });
}

// Roblox API functions to replace noblox.js
let robloxCookie = '';
let csrfToken = '';

async function setCookie(cookie) {
    robloxCookie = cookie;
    // Get CSRF token
    try {
        const response = await makeRequest({
            hostname: 'auth.roblox.com',
            path: '/v2/logout',
            method: 'POST',
            headers: {
                'Cookie': `.ROBLOSECURITY=${cookie}`,
                'Content-Length': '0'
            }
        });
        
        if (response.headers['x-csrf-token']) {
            csrfToken = response.headers['x-csrf-token'];
        }
    } catch (error) {
        // CSRF token extraction from error response
        if (error.message && error.message.includes('x-csrf-token')) {
            const match = error.message.match(/x-csrf-token: ([^,\s]+)/);
            if (match) {
                csrfToken = match[1];
            }
        }
    }
}

async function getAuthenticatedUser() {
    try {
        const response = await makeRequest({
            hostname: 'users.roblox.com',
            path: '/v1/users/authenticated',
            method: 'GET',
            headers: {
                'Cookie': `.ROBLOSECURITY=${robloxCookie}`
            }
        });

        if (response.statusCode === 200) {
            const userData = JSON.parse(response.body);
            return { id: userData.id, name: userData.name };
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function getFriends(userId) {
    try {
        const response = await makeRequest({
            hostname: 'friends.roblox.com',
            path: `/v1/users/${userId}/friends`,
            method: 'GET',
            headers: {
                'Cookie': `.ROBLOSECURITY=${robloxCookie}`
            }
        });

        if (response.statusCode === 200) {
            return JSON.parse(response.body);
        }
        return null;
    } catch (error) {
        return null;
    }
}

async function removeFriend(userId) {
    try {
        const response = await makeRequest({
            hostname: 'friends.roblox.com',
            path: `/v1/users/${userId}/unfriend`,
            method: 'POST',
            headers: {
                'Cookie': `.ROBLOSECURITY=${robloxCookie}`,
                'X-CSRF-TOKEN': csrfToken,
                'Content-Type': 'application/json',
                'Content-Length': '0'
            }
        });

        if (response.statusCode === 200) {
            return true;
        }
        throw new Error(`Failed to unfriend user ${userId}: ${response.statusCode}`);
    } catch (error) {
        throw error;
    }
}

async function getIdFromUsername(username) {
    try {
        const requestData = JSON.stringify({
            usernames: [username],
            excludeBannedUsers: true
        });

        const response = await makeRequest({
            hostname: 'users.roblox.com',
            path: '/v1/usernames/users',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(requestData)
            }
        }, requestData);

        if (response.statusCode === 200) {
            const data = JSON.parse(response.body);
            if (data.data && data.data.length > 0) {
                return data.data[0].id;
            }
        }
        return null;
    } catch (error) {
        return null;
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getSecureInput(prompt) {
    return new Promise(resolve => {
        process.stdout.write(prompt + ' ');
        let input = '';
        
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf-8');
        
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
            
            if (char === '\u0008' || char === '\u007f') {
                input = input.slice(0, -1);
                return;
            }
            
            input += char;
        };
        
        process.stdin.on('data', onData);
    });
}

function getNormalInput(query) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    
    return new Promise(resolve => {
        rl.question(query, value => {
            rl.close();
            resolve(value);
        });
    });
}

function waitForKeyPress(message = "Press any key to exit...") {
    return new Promise(resolve => {
        console.log(message);
        
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf-8');
        
        const onData = (char) => {
            char = char.toString();
            
            // Handle Ctrl+C
            if (char === '\u0003') {
                process.stdin.setRawMode(false);
                process.stdin.removeListener('data', onData);
                process.stdin.pause();
                process.exit();
            }
            
            // Any other key press
            process.stdin.setRawMode(false);
            process.stdin.removeListener('data', onData);
            process.stdin.pause();
            resolve();
        };
        
        process.stdin.on('data', onData);
    });
}

// Integrated encryption functionality from encryptCookie.js
async function encryptCookie(cookie, secretKey) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(16);
    
    // Use PBKDF2 to derive a 32-byte key from any length password
    const key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha256');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(cookie, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return salt.toString('hex') + ':' + iv.toString('hex') + ':' + encrypted;
}

async function manualCookieSetup() {
    try {
        console.log('\n===== MANUAL COOKIE SETUP =====');
        const cookie = await getSecureInput('Enter your .ROBLOSECURITY cookie (Output is hidden):');
        
        let secretKey;
        while (true) {
            secretKey = await getSecureInput('Enter a secret key for encryption:');
            
            if (secretKey.length < 1) {
                console.log('\n[ERROR] Secret key cannot be empty.');
                continue;
            }
            
            const confirmKey = await getSecureInput('Confirm your secret key (re-enter):');
            
            if (secretKey === confirmKey) {
                break;
            } else {
                console.log('\n[ERROR] Secret keys do not match. Please try again.');
            }
        }

        const encryptedData = await encryptCookie(cookie, secretKey);

        // Get the directory where the executable is running
        const execDir = process.pkg ? path.dirname(process.execPath) : process.cwd();
        const cookieFile = path.join(execDir, 'cookie.enc');

        await fs.writeFile(cookieFile, encryptedData, 'utf8');
        console.log('\n[SUCCESS] Cookie encrypted and saved to cookie.enc');
        console.log('[INFO] Keep your secret key safe! You will need it to decrypt the cookie.');
        return true;

    } catch (error) {
        console.log(`\n[ERROR] Manual cookie setup failed: ${error.message}`);
        await waitForKeyPress();
        return false;
    }
}

// Function to create required text files if they don't exist
async function createRequiredFiles() {
    // Get the directory where the executable is running
    const execDir = process.pkg ? path.dirname(process.execPath) : process.cwd();
    
    const files = [
        {
            name: 'include.txt',
            content: '// Add usernames or IDs to unfriend (one per line)\n'
        },
        {
            name: 'exclude.txt',
            content: '// Add usernames or IDs to not unfriend (one per line)\n'
        },
        {
            name: 'hold.txt',
            content: '// Do not edit this file, it\'s a fallback method in case something goes wrong.\n'
        }
    ];

    for (const file of files) {
        const filePath = path.join(execDir, file.name);
        try {
            await fs.access(filePath);
        } catch (error) {
            // File doesn't exist, create it
            await fs.writeFile(filePath, file.content, 'utf8');
            console.log(`[INFO] Created ${file.name}`);
        }
    }
}

async function main() {
    // Get the directory where the executable is running
    const execDir = process.pkg ? path.dirname(process.execPath) : process.cwd();
    
    const cookieFile = path.join(execDir, 'cookie.enc');
    const targetsFile = path.join(execDir, 'include.txt');
    const excludeFile = path.join(execDir, 'exclude.txt');
    const holdFile = path.join(execDir, 'hold.txt');

    try {
        console.log('===== Starting Roblox Unfriend Script =====');
        
        // Create required files if they don't exist
        await createRequiredFiles();

        // Check if cookie file exists and offer authentication options
        let cookieExists = false;
        try {
            await fs.access(cookieFile);
            cookieExists = true;
        } catch (error) {
            // Cookie file doesn't exist
        }

        let cookie;
        
        if (cookieExists) {
            // Cookie file exists, offer choice
            console.log('\n===== AUTHENTICATION OPTIONS =====');
            console.log('1. Use existing encrypted cookie (cookie.enc)');
            console.log('2. Login with browser (will replace existing cookie)');
            console.log('3. Manual cookie entry (will replace existing cookie)');
            console.log('===================================');
            
            let authChoice;
            while (true) {
                authChoice = await getNormalInput('Choose authentication method (1, 2, or 3): ');
                const trimmedChoice = authChoice.trim();
                if (trimmedChoice === '1' || trimmedChoice === '2' || trimmedChoice === '3') {
                    break;
                }
                console.log('[ERROR] Invalid choice. Please enter 1, 2, or 3.');
            }
            
            if (authChoice.trim() === '2') {
                // Use browser login
                console.log('\n[INFO] Starting browser authentication...');
                const retrievedCookie = await browserLogin();
                if (!retrievedCookie) {
                    console.log('[ERROR] Browser authentication failed');
                    await waitForKeyPress();
                    return;
                }
                
                // Get secret key for encryption
                let secretKey;
                while (true) {
                    secretKey = await getSecureInput('Enter a secret key for encryption (Output hidden):');
                    
                    if (secretKey.length < 1) {
                        console.log('\n[ERROR] Secret key cannot be empty.');
                        continue;
                    }
                    
                    const confirmKey = await getSecureInput('Confirm your secret key (re-enter):');
                    
                    if (secretKey === confirmKey) {
                        break;
                    } else {
                        console.log('\n[ERROR] Secret keys do not match. Please try again.');
                    }
                }
                
                // Encrypt and save the cookie
                const encryptedData = await encryptCookie(retrievedCookie, secretKey);
                const execDir = process.pkg ? path.dirname(process.execPath) : process.cwd();
                const cookieFile = path.join(execDir, 'cookie.enc');
                await fs.writeFile(cookieFile, encryptedData, 'utf8');
                console.log('\n[SUCCESS] Cookie encrypted and saved to cookie.enc');
            } else if (authChoice.trim() === '3') {
                // Use manual cookie entry
                console.log('\n[INFO] Starting manual cookie setup...');
                const setupSuccess = await manualCookieSetup();
                if (!setupSuccess) {
                    console.log('[ERROR] Manual cookie setup failed');
                    await waitForKeyPress();
                    return;
                }
                // After successful manual setup, the cookie.enc file is updated
                // Continue with the existing cookie loading logic
            }
            // If choice is 1 or anything else, continue with existing cookie
        } else {
            // No cookie file exists, offer options
            console.log('\n===== FIRST TIME SETUP =====');
            console.log('No encrypted cookie found. Choose setup method:');
            console.log('1. Login with browser (Recommended - Easy setup)');
            console.log('2. Manual cookie entry (Advanced users)');
            console.log('=============================');
            
            let setupChoice;
            while (true) {
                setupChoice = await getNormalInput('Choose setup method (1 or 2): ');
                const trimmedChoice = setupChoice.trim();
                if (trimmedChoice === '1' || trimmedChoice === '2') {
                    break;
                }
                console.log('[ERROR] Invalid choice. Please enter 1 or 2.');
            }
            
            if (setupChoice.trim() === '1') {
                // Use browser login
                console.log('\n[INFO] Starting browser authentication...');
                const retrievedCookie = await browserLogin();
                if (!retrievedCookie) {
                    console.log('[ERROR] Browser authentication failed');
                    await waitForKeyPress();
                    return;
                }
                
                // Get secret key for encryption
                let secretKey;
                while (true) {
                    secretKey = await getSecureInput('Enter a secret key for encryption (Output hidden):');
                    
                    if (secretKey.length < 1) {
                        console.log('\n[ERROR] Secret key cannot be empty.');
                        continue;
                    }
                    
                    const confirmKey = await getSecureInput('Confirm your secret key (re-enter):');
                    
                    if (secretKey === confirmKey) {
                        break;
                    } else {
                        console.log('\n[ERROR] Secret keys do not match. Please try again.');
                    }
                }
                
                // Encrypt and save the cookie
                const encryptedData = await encryptCookie(retrievedCookie, secretKey);
                const execDir = process.pkg ? path.dirname(process.execPath) : process.cwd();
                const cookieFile = path.join(execDir, 'cookie.enc');
                await fs.writeFile(cookieFile, encryptedData, 'utf8');
                console.log('\n[SUCCESS] Cookie encrypted and saved to cookie.enc');
            } else {
                // Manual setup
                console.log('\n[INFO] Starting manual cookie setup...');
                const setupSuccess = await manualCookieSetup();
                if (!setupSuccess) {
                    console.log('[ERROR] Manual cookie setup failed');
                    await waitForKeyPress();
                    return;
                }
            }
        }

        // Load and decrypt the cookie
        let encryptedData;
        try {
            encryptedData = await fs.readFile(cookieFile, 'utf8');
        } catch (error) {
            console.log('[ERROR] Failed to load encrypted cookie file after authentication');
            await waitForKeyPress();
            return;
        }

        const secretKey = await getSecureInput('Enter your secret key (Output is hidden):');

        const parts = encryptedData.split(':');
        let salt, iv, encrypted;
        
        if (parts.length === 3) {
            // New format: salt:iv:encrypted
            [salt, iv, encrypted] = parts;
            salt = Buffer.from(salt, 'hex');
            iv = Buffer.from(iv, 'hex');
        } else if (parts.length === 2) {
            // Old format: iv:encrypted (for backward compatibility)
            [iv, encrypted] = parts;
            iv = Buffer.from(iv, 'hex');
            salt = null;
        } else {
            console.log('\n[ERROR] Invalid encrypted cookie format.');
            await waitForKeyPress();
            return;
        }
        
        try {
            let key;
            if (salt) {
                // New format: derive key using PBKDF2
                key = crypto.pbkdf2Sync(secretKey, salt, 100000, 32, 'sha256');
            } else {
                // Old format: pad/truncate key to 32 bytes
                key = Buffer.from(secretKey.padEnd(32, ' ').slice(0, 32));
            }
            
            const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
            cookie = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
        } catch (error) {
            console.log('\n[ERROR] Failed to decrypt cookie. Check your secret key.');
            await waitForKeyPress();
            return;
        }

        if (!cookie || cookie.trim() === '') {
            console.log('[ERROR] Decrypted cookie is empty or invalid');
            await waitForKeyPress();
            return;
        }

        await setCookie(cookie.trim());
        const currentUser = await getAuthenticatedUser();
        if (!currentUser || !currentUser.id) {
            console.log('[ERROR] Failed to retrieve user info. Cookie may be invalid');
            await waitForKeyPress();
            return;
        }
        console.log(`[SUCCESS] Logged in as ${currentUser.name} (ID: ${currentUser.id})`);

        // Clear console after successful login to reduce clutter
        console.clear();
        console.log(`[SUCCESS] Logged in as ${currentUser.name} (ID: ${currentUser.id})`);

        // Display mode descriptions
        console.log('\n===== MODE DESCRIPTIONS =====');
        console.log('Inclusive: Removes friends you have added in the include.txt file.');
        console.log('Exclusive: Removes ALL users except for those added within the exclude.txt file.');
        console.log('==============================\n');

        console.log('[INFO] Waiting for mode selection...');
        let mode;
        while (true) {
            mode = await getNormalInput('Choose mode (inclusive/exclusive): ');
            const trimmedMode = mode.trim().toLowerCase();
            if (trimmedMode === 'inclusive' || trimmedMode === 'exclusive') {
                break;
            }
            console.log('[ERROR] Invalid mode. Please enter "inclusive" or "exclusive".');
        }
        console.log(`===== Running in ${mode.toUpperCase()} Mode =====`);

        let successCount = 0;
        let warnCount = 0;
        let errorCount = 0;
        let holdList = [];

        if (mode.trim().toLowerCase() === 'inclusive') {
            let targets;
            try {
                targets = await fs.readFile(targetsFile, 'utf8');
                console.log('[SUCCESS] Loaded include.txt');
            } catch (error) {
                console.log('[ERROR] Include file (include.txt) not found or empty');
                await waitForKeyPress();
                return;
            }

            const targetList = targets.split('\n').map(line => line.trim()).filter(line => line !== '' && !line.startsWith('//'));
            if (targetList.length === 0) {
                console.log('[WARN] No valid users found in include.txt');
                await waitForKeyPress();
                return;
            }

            console.log(`[INFO] Processing ${targetList.length} targets:`);
            console.log('-'.repeat(40));
            let unfriendCount = 0;
            for (const target of targetList) {
                const result = await processTarget(target, currentUser.id);
                if (result.success) {
                    successCount++;
                    unfriendCount++;
                    if (unfriendCount % 20 === 0) {
                        console.log('[INFO] Rate limit prevention: Waiting 7 seconds before continuing...');
                        await delay(7000);
                    }
                } else if (result.warn) {
                    warnCount++;
                    holdList.push(target);
                } else if (result.error) {
                    errorCount++;
                    holdList.push(target);
                }
            }
            console.log('-'.repeat(40));
        } else {
            console.log('\n[WARNING] You are about to purge your entire friend list except for excluded users.');
            console.log('[WARNING] This action cannot be undone.');
            console.log('[INFO] To proceed, type "yes unfriend" (without quotes):');
            
            const confirmation = await getNormalInput('Confirmation: ');
            if (confirmation.trim().toLowerCase() !== 'yes unfriend') {
                console.log('[INFO] Operation cancelled by user');
                await waitForKeyPress();
                return;
            }

            let excludeList = [];
            try {
                const excludeData = await fs.readFile(excludeFile, 'utf8');
                excludeList = excludeData.split('\n').map(line => line.trim()).filter(line => line !== '' && !line.startsWith('//'));
                console.log('[SUCCESS] Loaded exclude.txt');
            } catch (error) {
                console.log('[WARN] exclude.txt not found or empty. Proceeding with no exclusions');
            }

            const excludeIds = new Set();
            console.log(`[INFO] Resolving ${excludeList.length} exclusions:`);
            for (const exclude of excludeList) {
                const id = await resolveToId(exclude);
                if (id) excludeIds.add(id);
            }
            console.log(`[INFO] Excluding ${excludeIds.size} users`);

            const friendsResponse = await getFriends(currentUser.id);
            if (!friendsResponse || !friendsResponse.data) {
                console.log('[ERROR] Failed to retrieve friends list or no friends found');
                await waitForKeyPress();
                return;
            }
            const friends = friendsResponse.data;
            console.log(`[INFO] Found ${friends.length} friends. Processing:`);
            console.log('-'.repeat(40));
            let unfriendCount = 0;
            for (const friend of friends) {
                const friendId = friend.id;
                if (!excludeIds.has(friendId)) {
                    try {
                        await removeFriend(friendId);
                        console.log(`  [INFO] Unfriended username: ${friend.name} (${friendId})`);
                        successCount++;
                        unfriendCount++;
                        if (unfriendCount % 20 === 0) {
                            console.log('[INFO] Rate limit prevention: Waiting 7 seconds...');
                            await delay(7000);
                        }
                    } catch (error) {
                        console.log(`  [ERROR] Failed to unfriend ${friend.name} (ID: ${friendId}): ${error.message}`);
                        errorCount++;
                        holdList.push(friend.name);
                    }
                } else {
                    console.log(`  [INFO] Skipped excluded user ${friend.name} (ID: ${friendId})`);
                }
            }
            console.log('-'.repeat(40));
        }

        // Display stats
        console.log(`[STATS] Unfriended: ${successCount} users`);
        console.log(`[STATS] Warnings: ${warnCount} users`);
        console.log(`[STATS] Errors: ${errorCount} users`);

        // Write hold list to hold.txt if there are any warnings or errors
        if (holdList.length > 0) {
            await fs.writeFile(holdFile, holdList.join('\n'));
            console.log(`[INFO] ${holdList.length} users with warnings or errors saved to ${holdFile}`);

            // Ask user if they want to retry
            console.log('[INFO] Would you like to retry unfriending users from hold.txt?');
            let retryAnswer;
            while (true) {
                retryAnswer = await getNormalInput('Enter "yes" to retry, "no" to exit: ');
                const trimmedAnswer = retryAnswer.trim().toLowerCase();
                if (trimmedAnswer === 'yes' || trimmedAnswer === 'no') {
                    break;
                }
                console.log('[ERROR] Invalid input. Please enter "yes" or "no".');
            }
            if (retryAnswer.trim().toLowerCase() === 'yes') {
                console.log(`[INFO] Retrying ${holdList.length} users from hold.txt:`);
                console.log('-'.repeat(40));
                let retrySuccessCount = 0;
                let retryWarnCount = 0;
                let retryErrorCount = 0;
                let newHoldList = [];
                let unfriendCount = 0;

                for (const target of holdList) {
                    const result = await processTarget(target, currentUser.id);
                    if (result.success) {
                        retrySuccessCount++;
                        unfriendCount++;
                        if (unfriendCount % 20 === 0) {
                            console.log('[INFO] Rate limit prevention: Waiting 7 seconds...');
                            await delay(7000);
                        }
                    } else if (result.warn) {
                        retryWarnCount++;
                        newHoldList.push(target);
                    } else if (result.error) {
                        retryErrorCount++;
                        newHoldList.push(target);
                    }
                }

                console.log('-'.repeat(40));
                console.log(`[RETRY STATS] Unfriended: ${retrySuccessCount} users`);
                console.log(`[RETRY STATS] Warnings: ${retryWarnCount} users`);
                console.log(`[RETRY STATS] Errors: ${retryErrorCount} users`);

                // Update hold.txt with remaining failed users
                if (newHoldList.length > 0) {
                    await fs.writeFile(holdFile, newHoldList.join('\n'));
                    console.log(`[INFO] ${newHoldList.length} users still failed and updated in ${holdFile}`);
                } else {
                    await fs.unlink(holdFile);
                    console.log(`[INFO] All retries successful, ${holdFile} deleted`);
                }
            } else {
                console.log('[INFO] Retry skipped, users remain in hold.txt');
            }
        }

        console.log(`===== ${mode.toUpperCase()} Mode Completed =====`);
        await waitForKeyPress();
    } catch (error) {
        console.log(`[ERROR] Fatal error: ${error.message}`);
        await waitForKeyPress();
    }
}

async function processTarget(target, currentUserId) {
    try {
        let userId;
        if (/^\d+$/.test(target)) {
            userId = parseInt(target);
        } else {
            userId = await getIdFromUsername(target);
            if (!userId) {
                console.log(`  [WARN] Failed to resolve ${target} to an ID. Skipping`);
                return { success: false, warn: true, error: false };
            }
        }

        if (userId === currentUserId) {
            console.log(`  [WARN] Cannot unfriend yourself (ID: ${userId}). Skipping`);
            return { success: false, warn: true, error: false };
        }

        await removeFriend(userId);
        console.log(`  [INFO] Unfriended username: ${target} (${userId})`);
        return { success: true, warn: false, error: false };
    } catch (error) {
        console.log(`  [ERROR] Failed to unfriend ${target}: ${error.message}`);
        return { success: false, warn: false, error: true };
    }
}

async function resolveToId(target) {
    if (/^\d+$/.test(target)) {
        return parseInt(target);
    } else {
        try {
            const id = await getIdFromUsername(target);
            return id;
        } catch (error) {
            console.log(`  [WARN] Failed to resolve ${target}: ${error.message}`);
            return null;
        }
    }
}

main();