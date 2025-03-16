const noblox = require('noblox.js');
const fs = require('fs').promises;
const crypto = require('crypto');
const readline = require('readline');

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

async function main() {
    const cookieFile = 'cookie.enc';
    const targetsFile = 'include.txt';
    const excludeFile = 'exclude.txt';
    const holdFile = 'hold.txt';

    try {
        console.log('===== Starting Roblox Unfriend Script =====');

        let encryptedData;
        try {
            encryptedData = await fs.readFile(cookieFile, 'utf8');
            console.log('[SUCCESS] Loaded encrypted cookie file');
        } catch (error) {
            console.log('[ERROR] Encrypted cookie file (cookie.enc) not found. Encrypt your cookie first.');
            return;
        }

        console.log('[INFO] Waiting for secret key...');
        const secretKey = await getSecureInput('Enter your secret key (Output is hidden):');

        const [ivHex, encrypted] = encryptedData.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const key = Buffer.from(secretKey.padEnd(32, ' ').slice(0, 32));
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let cookie;
        try {
            cookie = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
            console.log('\n[SUCCESS] Cookie decrypted successfully');
        } catch (error) {
            console.log('\n[ERROR] Failed to decrypt cookie. Check your secret key.');
            return;
        }

        if (!cookie || cookie.trim() === '') {
            console.log('[ERROR] Decrypted cookie is empty or invalid');
            return;
        }

        await noblox.setCookie(cookie.trim());
        const currentUser = await noblox.getAuthenticatedUser();
        if (!currentUser || !currentUser.id) {
            console.log('[ERROR] Failed to retrieve user info. Cookie may be invalid');
            return;
        }
        console.log(`[SUCCESS] Logged in as ${currentUser.name} (ID: ${currentUser.id})`);

        console.log('[INFO] Waiting for mode selection...');
        const mode = await getNormalInput('Choose mode (inclusive/exclusive): ');

        if (mode.trim().toLowerCase() !== 'inclusive' && mode.trim().toLowerCase() !== 'exclusive') {
            console.log('[ERROR] Invalid mode. Use "inclusive" or "exclusive"');
            return;
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
                console.log('[SUCCESS] Loaded targets.txt');
            } catch (error) {
                console.log('[ERROR] Targets file (targets.txt) not found or empty');
                return;
            }

            const targetList = targets.split('\n').map(line => line.trim()).filter(line => line !== '');
            if (targetList.length === 0) {
                console.log('[WARN] No valid targets found in targets.txt');
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
                        console.log('[INFO] Rate limit prevention: Waiting 7 seconds...');
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
                return;
            }

            let excludeList = [];
            try {
                const excludeData = await fs.readFile(excludeFile, 'utf8');
                excludeList = excludeData.split('\n').map(line => line.trim()).filter(line => line !== '');
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

            const friendsResponse = await noblox.getFriends(currentUser.id);
            if (!friendsResponse || !friendsResponse.data) {
                console.log('[ERROR] Failed to retrieve friends list or no friends found');
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
                        await noblox.removeFriend(friendId);
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
            const retryAnswer = await getNormalInput('Enter "yes" to retry, "no" to exit: ');
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
    } catch (error) {
        console.log(`[ERROR] Fatal error: ${error.message}`);
    }
}

async function processTarget(target, currentUserId) {
    try {
        let userId;
        if (/^\d+$/.test(target)) {
            userId = parseInt(target);
        } else {
            userId = await noblox.getIdFromUsername(target);
            if (!userId) {
                console.log(`  [WARN] Failed to resolve ${target} to an ID. Skipping`);
                return { success: false, warn: true, error: false };
            }
        }

        if (userId === currentUserId) {
            console.log(`  [WARN] Cannot unfriend yourself (ID: ${userId}). Skipping`);
            return { success: false, warn: true, error: false };
        }

        await noblox.removeFriend(userId);
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
            const id = await noblox.getIdFromUsername(target);
            return id;
        } catch (error) {
            console.log(`  [WARN] Failed to resolve ${target}: ${error.message}`);
            return null;
        }
    }
}

main();