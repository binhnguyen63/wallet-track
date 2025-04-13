ETHEREUM WALLET TRACKING BOT

# Step 1: Add ETH wallet that you want to track

-   You can either modify the data/monitor-addresses.json or run the following command line

```
    node -e "require('./functions/manipulateTxData.js').addUser('userName','address')"
```

# Step 2: Run the program

-   Run main.js

```
    node main.js
```
