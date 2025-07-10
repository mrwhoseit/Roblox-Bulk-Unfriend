const puppeteer = require('puppeteer');

function waitForKeyPress(message = "Press any key to continue...") {
    return new Promise(resolve => {
        console.log(message);
        
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf-8');
        
        const onData = (char) => {
            char = char.toString();
            
            if (char === '\u0003') {
                process.stdin.setRawMode(false);
                process.stdin.removeListener('data', onData);
                process.stdin.pause();
                process.exit();
            }
            
            process.stdin.setRawMode(false);
            process.stdin.removeListener('data', onData);
            process.stdin.pause();
            resolve();
        };
        
        process.stdin.on('data', onData);
    });
}

async function browserLogin() {
    let browser;
    try {
        console.log('===== Roblox Browser Authentication =====');
        
        console.log('[INFO] The program will automatically detect when you are logged in.');
        console.log('[INFO] Do NOT close the browser window manually.\n');
        
        // Add a 1-second delay so user can read the messages
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Launch browser with visible UI and performance optimizations
        browser = await puppeteer.launch({
            headless: false,
            defaultViewport: { width: 500, height: 700 },
            args: [
                '--window-size=500,700',
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-web-security',
                '--disable-features=VizDisplayCompositor',
                '--disable-background-networking',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
                '--disable-backgrounding-occluded-windows',
                '--disable-ipc-flooding-protection'
            ]
        });

        // Get the first page (default about:blank tab) and navigate it to Roblox
        const pages = await browser.pages();
        const page = pages[0]; // Use the existing tab instead of creating a new one
        
        // Block unnecessary resources to speed up loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            const resourceType = req.resourceType();
            if (resourceType === 'image' || resourceType === 'media' || resourceType === 'font') {
                req.abort();
            } else {
                req.continue();
            }
        });
        
        // Navigate to Roblox login page with faster loading strategy
        console.log('[INFO] Loading Roblox login page...');
        await page.goto('https://www.roblox.com/login', {
            waitUntil: 'domcontentloaded', // Much faster than networkidle2
            timeout: 15000 // Reduced timeout since we're not waiting for all resources
        });
        
        // Wait for the login form to be ready instead of all network activity
        try {
            await page.waitForSelector('input[type="text"], input[type="email"], #username, [data-testid="username-input"]', {
                timeout: 10000
            });
            console.log('[INFO] Login page loaded successfully.');
        } catch (e) {
            console.log('[WARN] Login form not immediately visible, but page loaded. You can still proceed with login.');
        }

        // Wait for successful login by checking for the presence of authentication cookie
        let roblosecurityCookie = null;
        let attempts = 0;
        const maxAttempts = 300; // 5 minutes timeout (300 * 1 second)

        while (!roblosecurityCookie && attempts < maxAttempts) {
            try {
                // Check if browser/page is still open
                if (browser && !browser.isConnected()) {
                    throw new Error('Browser window was closed by user');
                }
                
                // Check if page is still accessible
                try {
                    await page.evaluate('document.readyState');
                } catch (pageError) {
                    if (pageError.message && (pageError.message.includes('Session closed') || pageError.message.includes('Target closed'))) {
                        throw new Error('Browser window was closed by user');
                    }
                    throw pageError;
                }
                
                // Check if we're on a logged-in page by looking for user-specific elements
                const cookies = await page.cookies();
                const roblosecurity = cookies.find(cookie => cookie.name === '.ROBLOSECURITY');
                
                if (roblosecurity && roblosecurity.value && roblosecurity.value.length > 50) {
                    // Verify the cookie is valid by checking if we can access user info
                    const currentUrl = page.url();
                    if (currentUrl.includes('roblox.com') && !currentUrl.includes('/login')) {
                        // Additional verification: check if user menu is present
                        try {
                            await page.waitForSelector('[data-testid="navigation-user-menu"], .navbar-right, #navigation-user-menu', { timeout: 2000 });
                            roblosecurityCookie = roblosecurity.value;
                            break;
                        } catch (e) {
                            // User menu not found, continue waiting
                        }
                    }
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
                attempts++;
                
                // Show progress every 30 seconds
                if (attempts % 30 === 0) {
                    console.log(`[INFO] Still waiting for login... (${Math.floor(attempts/60)} minutes elapsed)`);
                }
                
            } catch (error) {
                // Handle browser closure gracefully
                if (error.message.includes('Browser window was closed by user') ||
                    error.message.includes('Session closed') ||
                    error.message.includes('Target closed')) {
                    throw new Error('Browser window was closed. Please keep the browser open during authentication.');
                }
                
                // For other errors, show warning but continue
                console.log(`[WARN] Error checking login status: ${error.message || 'Unknown error'}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
                attempts++;
            }
        }

        if (!roblosecurityCookie) {
            throw new Error('Login timeout. Please try again and log in within 5 minutes.');
        }

        console.log('[SUCCESS] Cookie retrieved from browser.\n');
        
        // Close the browser
        await browser.close();
        browser = null;

        // Return the cookie instead of handling encryption here
        return roblosecurityCookie;

    } catch (error) {
        console.log(`\n[ERROR] Browser authentication failed: ${error.message}`);
        
        if (error.message.includes('Could not find expected browser')) {
            console.log('[INFO] Puppeteer requires Chromium to be installed.');
            console.log('[INFO] Please install it by running: npm install puppeteer');
        }
        
        await waitForKeyPress();
        return null;
    } finally {
        // Ensure browser is closed even if an error occurs
        if (browser) {
            try {
                await browser.close();
            } catch (e) {
                console.log('[WARN] Error closing browser:', e.message);
            }
        }
    }
}

// Check if this script is being run directly
if (require.main === module) {
    browserLogin().then(cookie => {
        if (cookie) {
            console.log('[SUCCESS] Cookie retrieved successfully');
            console.log('[INFO] Cookie value:', cookie.substring(0, 20) + '...');
        } else {
            console.log('[ERROR] Failed to retrieve cookie');
        }
    });
}

module.exports = { browserLogin };