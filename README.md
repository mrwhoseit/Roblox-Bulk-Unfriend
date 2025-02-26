# Roblox Bulk Unfriend

This project provides a script to manage your Roblox friends list by allowing you to bulk unfriend users. The project was created to help battle the issue with unfriending users when exceeding 500 friends. This script supports two modes:

- **Inclusive Mode:** Unfriends specific users listed in a file.
- **Exclusive Mode:** Unfriends all friends except those listed in a file.

**⚠️ Warning:** This script uses your `.ROBLOSECURITY` cookie to authenticate with Roblox. Keep this cookie secure and never share it, as it grants full access to your account.

*Your cookie must first be encrypted with `encryptcookie.js` in order to run `unfriend.js`*

---
## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Setup](#setup)
3. [Usage](#usage)
4. [Security](#security)
5. [Troubleshooting](#troubleshooting)
---
## Prerequisites
Before using this script, ensure you have the following installed:

- **[Node.js](https://nodejs.org/)** (v14 or higher recommended)
- **[noblox.js](https://noblox.js.org/)** library

To install `noblox.js`, run the following command in your desired terminal:

```bash
npm install noblox.js
```

## Setup
1. **Clone or Download the Repository:**
    - Clone this repository or download the `unfriend.js` script to your local machine.
2. **Required Files:**
    - **cookie.enc:** This file will contain your .ROBLOSECURITY cookie. To obtain it:  
        - Log in to Roblox in your browser.
        - Use your browser's developer tools (e.g., F12 → Application → Cookies) to find the `.ROBLOSECURITY` cookie.
        - Copy the entire cookie string and paste it into the console upon running `encryptcookie.js`
      
    - **inclusive.txt:** List the user IDs or usernames of the people you want to unfriend
    - **exclusive.txt:** List the user IDs or usernames of the people you want to exclude from being unfriended (Running this mode will unfriend anyone not added to the list)

		**One user per line!** Example:
	```
     thatoneuser34234
     coolgamerkid391
     137268469
     mrwhoseitt
	```
	
## Usage
1. **Run the Script:**
    - Open a terminal (Command Prompt, PowerShell, or your preferred terminal) and navigate to the files directory.
	```
	cd /path/to/file/
	```
	- To setup your Roblox Cookie, run:
	```
	node encryptcookie.js
	```
    - For recursive use case, run:

    ```
    node unfriend.js
	```

#### Below are some examples on how to use the program:

**Inclusive Mode:**
```text
===== Starting Roblox Unfriend Script =====
[SUCCESS] Loaded cookie.txt
[SUCCESS] Logged in as YourUsername (ID: 123456789)
[INFO] Waiting for mode selection...
Choose mode (inclusive/exclusive): inclusive
===== Running in INCLUSIVE Mode =====
[SUCCESS] Loaded targets.txt
[INFO] Processing 2 targets:
----------------------------------------
  [INFO] Unfriending by ID: 123456
    [SUCCESS] Unfriended 123456 (ID: 123456)
  [INFO] Resolving username: CoolUser123
    [INFO] Resolved CoolUser123 to ID: 654321
    [SUCCESS] Unfriended CoolUser123 (ID: 654321)
----------------------------------------
===== INCLUSIVE Mode Completed =====
```

**Exclusive Mode:**
```
===== Starting Roblox Unfriend Script =====
[SUCCESS] Loaded cookie.txt
[SUCCESS] Logged in as YourUsername (ID: 123456789)
[INFO] Waiting for mode selection...
Choose mode (inclusive/exclusive): exclusive
===== Running in EXCLUSIVE Mode =====
[SUCCESS] Loaded exclude.txt
[INFO] Resolving 2 exclusions:
    [INFO] Resolved BestFriend99 to ID: 7891011
    [INFO] Resolved KeepThisGuy to ID: 9876543
[INFO] Excluding 2 users
[INFO] Found 4 friends. Processing:
----------------------------------------
  [SUCCESS] Unfriended Friend1 (ID: 111111)
  [INFO] Skipped excluded user BestFriend99 (ID: 7891011)
  [SUCCESS] Unfriended Friend2 (ID: 222222)
  [INFO] Skipped excluded user KeepThisGuy (ID: 9876543)
----------------------------------------
===== EXCLUSIVE Mode Completed =====
```

## Security
- **Cookie Protection:** The `.ROBLOSECURITY` cookie in `cookie.enc` allows full access to your Roblox account if your secret key is exposed. **Do not share this file or its contents.**
- **Secret Key:** Keep it in a safe place! It's required to make a password at least 32 characters long in order for the encryption to work with AES-256
- **Why is my cookie encrypted:** I care for privacy and security and it seems right for the programs I create to include some security to prevent compromised data. Some viruses are hard to spot!
- **What if I forget my Secret Key:** Delete your `cookie.enc` file then repeat the steps to setup your encrypted file.
## Troubleshooting
- **Windows Security:** You may see your anti-virus blocking you from downloading the given files. The file contains cryptographic functions which can be flagged as security risks. This is a common tactic for viruses not to be scanned and flagged from your PC!
- **Invalid Cookie:** If you see [ERROR] Failed to retrieve user info. Cookie may be invalid, ensure your `.ROBLOSECURITY` cookie is correct and not expired. Log out of Roblox and log back in to refresh it.
- **Missing Files:** Ensure `cookie.enc`, `include.txt`, and `exclude.txt` are in the same directory as `unfriend.js`.
- **User Not Found:** If a username in `include.txt` or `exclude.txt` cannot be resolved, check for typos or confirm the user exists on Roblox.
- **Execution Policy Issues (Windows):** If you encounter errors running `npm install`, try `npm.cmd install noblox.js` or adjust your PowerShell execution policy with:

```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

## License
This project is licensed under the [Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0).  
You are free to use, modify, and distribute this software in accordance with the terms of the Apache-2.0 license.
