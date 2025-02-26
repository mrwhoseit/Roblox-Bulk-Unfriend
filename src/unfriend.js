const noblox = require('noblox.js');
const fs = require('fs').promises;
const crypto = require('crypto');
const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    const cookieFile = 'cookie.enc';
    const targetsFile = 'include.txt';
    const excludeFile = 'exclude.txt';

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
        const secretKey = await new Promise((resolve) => {
            readline.question('Enter your secret key: ', (answer) => resolve(answer));
        });

        const [ivHex, encrypted] = encryptedData.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const key = Buffer.from(secretKey.padEnd(32, ' ').slice(0, 32));
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
        let cookie;
        try {
            cookie = decipher.update(encrypted, 'hex', 'utf8') + decipher.final('utf8');
            console.log('[SUCCESS] Cookie decrypted successfully');
        } catch (error) {
            console.log('[ERROR] Failed to decrypt cookie. Check your secret key.');
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
        const mode = await new Promise((resolve) => {
            readline.question('Choose mode (inclusive/exclusive): ', (answer) => resolve(answer.trim().toLowerCase()));
        });

        if (mode !== 'inclusive' && mode !== 'exclusive') {
            console.log('[ERROR] Invalid mode. Use "inclusive" or "exclusive"');
            return;
        }
        console.log(`===== Running in ${mode.toUpperCase()} Mode =====`);

        if (mode === 'inclusive') {
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
            for (const target of targetList) {
                await processTarget(target, currentUser.id);
            }
            console.log('-'.repeat(40));
        } else {
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

            for (const friend of friends) {
                const friendId = friend.id;
                if (!excludeIds.has(friendId)) {
                    try {
                        await noblox.removeFriend(friendId);
                        console.log(`  [SUCCESS] Unfriended ${friend.name} (ID: ${friendId})`);
                    } catch (error) {
                        console.log(`  [ERROR] Failed to unfriend ${friend.name} (ID: ${friendId}): ${error.message}`);
                    }
                } else {
                    console.log(`  [INFO] Skipped excluded user ${friend.name} (ID: ${friendId})`);
                }
            }
            console.log('-'.repeat(40));
        }

        console.log(`===== ${mode.toUpperCase()} Mode Completed =====`);
    } catch (error) {
        console.log(`[ERROR] Fatal error: ${error.message}`);
    } finally {
        readline.close();
    }
}

async function processTarget(target, currentUserId) {
    try {
        let userId;
        if (/^\d+$/.test(target)) {
            userId = parseInt(target);
            console.log(`  [INFO] Unfriending by ID: ${userId}`);
        } else {
            console.log(`  [INFO] Resolving username: ${target}`);
            userId = await noblox.getIdFromUsername(target);
            if (!userId) {
                console.log(`    [WARN] Failed to resolve ${target} to an ID. Skipping`);
                return;
            }
            console.log(`    [INFO] Resolved ${target} to ID: ${userId}`);
        }

        if (userId === currentUserId) {
            console.log(`    [WARN] Cannot unfriend yourself (ID: ${userId}). Skipping`);
            return;
        }

        await noblox.removeFriend(userId);
        console.log(`    [SUCCESS] Unfriended ${target} (ID: ${userId})`);
    } catch (error) {
        console.log(`    [ERROR] Failed to unfriend ${target}: ${error.message}`);
    }
}

async function resolveToId(target) {
    if (/^\d+$/.test(target)) {
        return parseInt(target);
    } else {
        try {
            const id = await noblox.getIdFromUsername(target);
            console.log(`    [INFO] Resolved ${target} to ID: ${id}`);
            return id;
        } catch (error) {
            console.log(`    [WARN] Failed to resolve ${target}: ${error.message}`);
            return null;
        }
    }
}

main();