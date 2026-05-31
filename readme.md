# 🌐 World Index Dashboard

Real-time global stock market dashboard showing major world indices with live price, change %, and volume. Built with Node.js + vanilla HTML/CSS/JS.
![Internet](https://github.com/inchinet/worldindex/blob/main/screen.png)

## Indices Covered

| # | Symbol | Name | Chart Link |
|---|--------|------|-----------|
| 1 | DJI | Dow Jones Industrial Average | TradingView |
| 2 | IXIC | Nasdaq Composite | TradingView |
| 3 | SPX | S&P 500 | TradingView |
| 4 | NI225 | Nikkei 225 (日經平均指數) | TradingView |
| 5 | IX0001 | Taiwan Weighted (加權指數) | TradingView |
| 6 | KOSPI | S.Korea KOSPI | TradingView |
| 7 | MCSI | MSCI World Index | Yahoo Finance *(no raw data on TradingView, it only has futures `MWL1!`)* |
| 8 | SOX | PHLX Semiconductor Index | TradingView |
| 9 | HSI | Hang Seng Index | TradingView |

## Stack

- **Backend**: Node.js (no dependencies, built-in `http`/`https`)
- **Data source**: Yahoo Finance (HTML scraping + quote API fallback)
- **Frontend**: Vanilla HTML/CSS/JS, liquid glass dark UI
- **Port**: `3002` (configurable via `WORLDINDEX_PORT` env var)

## Run Locally

```bash
node worldindex-server.js
# Open: http://localhost:3002/worldindex.html
```

## Deploy to Linux Server

### 1. Copy files to the target directory on the server.
```bash
sudo cp worldindex-server.js worldindex.html .
```

### 2. Start with PM2
```bash
cd /var/www/nextcloud/
pm2 start worldindex-server.js --name "worldindex-server"
pm2 save
```

### 3. Apache config — Proxy the API endpoint through Apache if needed:
```apache
ProxyPass /world-api http://localhost:3002/world-api
ProxyPassReverse /world-api http://localhost:3002/world-api
```

### 4. Reload Apache
```bash
sudo systemctl reload apache2
```



## PM2 Useful Commands

```bash
pm2 logs worldindex-server --lines 20
pm2 restart worldindex-server
pm2 status
```

## Debug Mode

```bash
WORLDINDEX_DEBUG=1 node worldindex-server.js
```

## 📜 License
MIT License - Developed by [inchinet](https://github.com/inchinet). Feel free to use and modify!