## Keybase Plugin

TODO:
-----
* final refactor
* tests

WISHLIST:
-----
* message signing
* encrypted file handling
* integrate MIT PGP Keyserver search into Keybase searchbar
* make the decrypt interface a message body overlay instead of a button in the header
* improve search result deduping with keys on file

How to install:
-----
1. Clone repository into any location
2. Run the command `cd /path/to/mailspring-keybase`
3. Install babel and other dependencies: `npm install`
4. Compile source codes to vanilla js with babel: `chmod +x ./node_modules/.bin/babel` and `./node_modules/.bin/babel src --out-dir lib`
3. Start Mailspring and add plugin - you should see a success notification
4. Close Mailspring and edit config.json and remove keybase from disabled plugins list (config.json can be found in different places depending on your OS. Search for the Mailspring folder in your filesystem). For linux you will find it in: `~/.config/Mailspring/config.json`
5. Start Mailspring, key management can be found in preferences
