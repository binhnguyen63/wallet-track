ETHEREUM WALLET TRACKING BOT

# Step 1: Add ETH wallet that you want to track

-   You can either modify the data/monitor-addresses.json or run the following command line

```
node -e "require('./functions/manipulateTxData.js').addUser('userName','address')"
```

# Step 2: Input API key needed in .env

```
ETHERSCAN_API_KEY=
WEBHOOK_ID=
WEBHOOK_TOKEN=
```

-   Discord Webhook

# Step 3: Install packages

```
npm install
```

# Step 3: Run the program

-   Run main.js

```
node main.js
```
