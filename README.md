# btc-race-trend-rider

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/yugot-coder/btc-race-trend-rider/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/yugot-coder/btc-race-trend-rider/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

A trend-riding trading bot for cbBTC/USDC on one-minute bars, built for make.fun's "Race a BTC trading bot live for 24 hours" bounty. A round trip in this market costs roughly 30 bps in fees, slippage and price impact, so the bot trades rarely and only with the trend: it goes long at 85% of equity when the close is above its 120-bar EMA and the last 90 bars gained at least +20 bps, exits on a -120 bps stop, a -90 bps trailing stop or after 360 bars, and sits out the chop in between. A two-step safeguard relaxes the entry late in the window only if the bot has not traded at all, so it always takes part with bounded risk. On the kit's frozen dev window it nets +7.88 USDC over 4 trades with a 1.13% maximum drawdown. The bot is a single `main.ts` speaking agent-fun/bars-replay/v1 over stdin/stdout, deterministic by construction (no clock, no environment, no randomness), with the kit's SDK shim vendored under `vendor/`.

## Run it

```sh
# With the competition kit unpacked beside this repository:
node cli/makefun.mjs grade-local --kit . --bot <this repository> --driver docker
# Or feed it a bars-replay/v1 hello/batch/done stream directly:
node main.ts
```

---
<sub>Entered on [make.fun](https://make.fun/?ref=za0zfbxx&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
