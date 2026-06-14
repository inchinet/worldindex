const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.WORLDINDEX_PORT || 3002);
const HTML_FILE = path.join(__dirname, 'worldindex.html');
const DEBUG = process.env.WORLDINDEX_DEBUG === '1';

console.clear();

const MARKETS = [
    {
        symbol: 'DJI',
        yahooSymbol: '^DJI',
        yahooTableSymbols: ['^DJI', 'DJI'],
        name: 'Dow Jones Industrial Average',
        chartUrl: 'https://www.tradingview.com/chart/pLzimNtz/?symbol=DJI',
        yahooChartUrl: 'https://finance.yahoo.com/chart/%5EDJI',
        icon: 'DJ',
        accent: '#f59e0b',
    },
    {
        symbol: 'IXIC',
        yahooSymbol: '^IXIC',
        yahooTableSymbols: ['^IXIC', 'IXIC'],
        name: 'Nasdaq Composite',
        chartUrl: 'https://www.tradingview.com/chart/pLzimNtz/?symbol=IXIC',
        yahooChartUrl: 'https://finance.yahoo.com/chart/%5EIXIC',
        icon: 'NQ',
        accent: '#22c55e',
    },
    {
        symbol: 'SPX',
        yahooSymbol: '^GSPC',
        yahooTableSymbols: ['^GSPC', 'GSPC', '^SPX', 'SPX'],
        name: 'S&P 500',
        chartUrl: 'https://www.tradingview.com/chart/pLzimNtz/?symbol=SPX',
        yahooChartUrl: 'https://finance.yahoo.com/chart/%5EGSPC',
        icon: 'S5',
        accent: '#38bdf8',
    },
    {
        symbol: 'NI225',
        yahooSymbol: '^N225',
        yahooTableSymbols: ['^N225', 'N225', 'NI225'],
        name: 'Nikkei 225',
        chartUrl: 'https://www.tradingview.com/chart/pLzimNtz/?symbol=NI225',
        yahooChartUrl: 'https://finance.yahoo.com/chart/%5EN225',
        icon: 'JP',
        accent: '#ef4444',
    },
    {
        symbol: 'IX0001',
        yahooSymbol: '^TWII',
        yahooTableSymbols: ['^TWII', 'TWII', 'IX0001'],
        name: 'Taiwan Weighted',
        chartUrl: 'https://www.tradingview.com/chart/pLzimNtz/?symbol=IX0001',
        yahooChartUrl: 'https://finance.yahoo.com/chart/%5ETWII',
        icon: 'TW',
        accent: '#8b5cf6',
    },
    {
        symbol: 'KOSPI',
        yahooSymbol: '^KS11',
        yahooTableSymbols: ['^KS11', 'KS11', 'KOSPI'],
        name: 'KOSPI',
        chartUrl: 'https://www.tradingview.com/chart/pLzimNtz/?symbol=KOSPI',
        yahooChartUrl: 'https://finance.yahoo.com/chart/%5EKS11',
        icon: 'KR',
        accent: '#0ea5e9',
    },
    {
        symbol: 'MCSI',
        yahooSymbol: '^990100-USD-STRD',
        yahooTableSymbols: ['^990100-USD-STRD', '990100-USD-STRD', 'MCSI'],
        name: 'MSCI World Index',
        yahooQuoteUrl: 'https://finance.yahoo.com/quote/%5E990100-USD-STRD/',
        chartUrl: 'https://finance.yahoo.com/quote/%5E990100-USD-STRD/',
        yahooChartUrl: 'https://finance.yahoo.com/chart/%5E990100-USD-STRD',
        icon: 'MS',
        accent: '#f97316',
    },
    {
        symbol: 'SOX',
        yahooSymbol: '^SOX',
        yahooTableSymbols: ['^SOX', 'SOX'],
        name: 'PHLX Semiconductor Index',
        chartUrl: 'https://www.tradingview.com/chart/pLzimNtz/?symbol=SOX',
        yahooChartUrl: 'https://finance.yahoo.com/chart/%5ESOX',
        icon: 'SOX',
        accent: '#facc15',
    },
    {
        symbol: 'HSI',
        yahooSymbol: '^HSI',
        yahooTableSymbols: ['^HSI', 'HSI'],
        name: 'Hang Seng Index',
        yahooQuoteUrl: 'https://hk.finance.yahoo.com/quote/%5EHSI/',
        chartUrl: 'https://www.tradingview.com/chart/pLzimNtz/?symbol=HSI',
        yahooChartUrl: 'https://finance.yahoo.com/chart/%5EHSI',
        icon: 'HK',
        accent: '#14b8a6',
    },
];

const YAHOO_WORLD_INDICES_URL = 'https://finance.yahoo.com/markets/world-indices/';

function formatNumber(value, digits = 2) {
    if (value == null || Number.isNaN(Number(value))) return 'N/A';
    return Number(value).toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    });
}

function formatVolume(value) {
    if (value == null || Number.isNaN(Number(value))) return 'N/A';
    const n = Number(value);
    if (n >= 1e9) return `${(n / 1e9).toFixed(2).replace(/\.?0+$/, '')}B`;
    if (n >= 1e6) return `${(n / 1e6).toFixed(2).replace(/\.?0+$/, '')}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(2).replace(/\.?0+$/, '')}K`;
    return n.toLocaleString('en-US');
}

function formatPercent(value) {
    if (value == null || Number.isNaN(Number(value))) return 'N/A';
    const n = Number(value);
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toFixed(2)}%`;
}

function formatSignedNumber(value, digits = 2) {
    if (value == null || Number.isNaN(Number(value))) return 'N/A';
    const n = Number(value);
    const sign = n > 0 ? '+' : '';
    return `${sign}${n.toLocaleString('en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
    })}`;
}

function fetchJson(url, redirectCount = 0) {
    if (redirectCount > 5) {
        return Promise.reject(new Error(`Too many redirects for ${url}`));
    }

    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                'Accept': 'application/json,text/plain,*/*',
                'Cache-Control': 'no-cache, no-store, max-age=0',
                'Pragma': 'no-cache',
                'Accept-Encoding': 'gzip, deflate, br',
            },
            timeout: 20000,
        }, res => {
            if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                const nextUrl = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : new URL(res.headers.location, url).href;
                res.resume();
                resolve(fetchJson(nextUrl, redirectCount + 1));
                return;
            }

            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(Buffer.from(chunk)));
            res.on('end', () => {
                try {
                    const raw = Buffer.concat(chunks);
                    const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
                    let body = raw;
                    if (encoding.includes('br')) body = zlib.brotliDecompressSync(body);
                    else if (encoding.includes('gzip')) body = zlib.gunzipSync(body);
                    else if (encoding.includes('deflate')) body = zlib.inflateSync(body);
                    resolve(JSON.parse(body.toString('utf8')));
                } catch (error) {
                    reject(new Error(`Invalid JSON from ${url}: ${error.message}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error(`Timeout fetching ${url}`)));
    });
}

function fetchText(url, redirectCount = 0) {
    if (redirectCount > 5) {
        return Promise.reject(new Error(`Too many redirects for ${url}`));
    }

    return new Promise((resolve, reject) => {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache, no-store, max-age=0',
                'Pragma': 'no-cache',
                'Accept-Encoding': 'gzip, deflate, br',
            },
            timeout: 20000,
        }, res => {
            if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                const nextUrl = res.headers.location.startsWith('http')
                    ? res.headers.location
                    : new URL(res.headers.location, url).href;
                res.resume();
                resolve(fetchText(nextUrl, redirectCount + 1));
                return;
            }

            if (res.statusCode !== 200) {
                res.resume();
                reject(new Error(`HTTP ${res.statusCode} for ${url}`));
                return;
            }

            const chunks = [];
            res.on('data', chunk => chunks.push(Buffer.from(chunk)));
            res.on('end', () => {
                try {
                    const raw = Buffer.concat(chunks);
                    const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
                    let body = raw;
                    if (encoding.includes('br')) body = zlib.brotliDecompressSync(body);
                    else if (encoding.includes('gzip')) body = zlib.gunzipSync(body);
                    else if (encoding.includes('deflate')) body = zlib.inflateSync(body);
                    resolve(body.toString('utf8'));
                } catch (error) {
                    reject(new Error(`Failed to decode response from ${url}: ${error.message}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error(`Timeout fetching ${url}`)));
    });
}

async function fetchChart1M(yahooSymbol) {
    try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1mo&_=${Date.now()}`;
        const json = await fetchJson(url);
        const result = json?.chart?.result?.[0];
        if (!result) return null;
        const closes = result.indicators?.quote?.[0]?.close || [];
        const timestamps = result.timestamp || [];
        const points = [];
        for (let i = 0; i < closes.length; i++) {
            if (closes[i] != null && timestamps[i] != null) {
                points.push({ t: timestamps[i], c: closes[i] });
            }
        }
        return points.length >= 2 ? points : null;
    } catch {
        return null;
    }
}

function extractYahooField(html, field) {
    const patterns = [
        new RegExp(`data-field="${field}"[^>]*data-value="([^"]+)"`, 'i'),
        new RegExp(`data-field="${field}"[^>]*>([^<]+)</fin-streamer>`, 'i'),
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1] != null) {
            return match[1].replace(/,/g, '').trim();
        }
    }

    return null;
}

function extractYahooVisiblePercent(html) {
    const patterns = [
        /data-testid="qsp-price-change-percent"[^>]*>\s*\(?([+-]?\d[\d,]*(?:\.\d+)?)%\)?/i,
        /percent-price-change[^>]*>[\s\S]{0,500}?class="[^"]*\b(txt-positive|txt-negative)[^"]*"[^>]*>\s*\(?([+-]?\d[\d,]*(?:\.\d+)?)%\)?/i,
        /class="[^"]*\b(txt-positive|txt-negative)[^"]*percent-price-change[^"]*"[^>]*>\s*\(?([+-]?\d[\d,]*(?:\.\d+)?)%\)?/i,
        /class="[^"]*\bchange\b[^"]*"[^>]*>\s*\(?([+-]?\d[\d,]*(?:\.\d+)?)%\)?/i,
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (!match) continue;

        const className = (match[1] || '').toLowerCase();
        const raw = match[2] || match[1];
        if (raw == null) continue;

        const value = Number(String(raw).replace(/,/g, ''));
        if (!Number.isFinite(value)) continue;

        if (className.includes('negative')) return -Math.abs(value);
        if (className.includes('positive')) return Math.abs(value);
        return value;
    }

    return null;
}

function extractYahooQspField(html, testId) {
    const patterns = [
        new RegExp(`data-testid="${testId}"[^>]*>\\s*([+-]?[\\d,]+(?:\\.\\d+)?)`, 'i'),
        new RegExp(`data-testid="${testId}"[^>]*>\\s*\\(?([+-]?[\\d,]+(?:\\.\\d+)?)`, 'i'),
    ];

    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (!match || match[1] == null) continue;
        const value = Number(match[1].replace(/,/g, ''));
        if (Number.isFinite(value)) return value;
    }

    return null;
}

function parseYahooNumber(text) {
    if (text == null) return null;
    const cleaned = String(text).replace(/[(),%\s]/g, '').replace(/,/g, '');
    if (!cleaned) return null;
    const value = Number(cleaned);
    return Number.isFinite(value) ? value : null;
}

function stripTags(html) {
    return String(html || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
}

function parseYahooWorldIndices(html) {
    const rows = new Map();
    const rowRegex = /<tr[^>]*data-testid-row[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(html)) !== null) {
        const row = rowMatch[1];
        const symbolMatch = row.match(/class="symbol[^"]*"[^>]*>([^<]+)/i)
            || row.match(/data-testid-cell="ticker"[\s\S]*?>([^<]+)/i);
        if (!symbolMatch) continue;

        const sourceSymbol = stripTags(symbolMatch[1]).toUpperCase();
        const priceMatch = row.match(/data-testid-cell="intradayprice"[\s\S]*?>([\d,.]+)/i);
        const changeMatch = row.match(/data-testid-cell="change"[\s\S]*?>([-+]?\d[\d,.]*)/i);
        const percentMatch = row.match(/data-testid-cell="percentchange"[\s\S]*?>([-+]?\d[\d,.]*)%/i)
            || row.match(/data-testid-cell="regularMarketChangePercent"[\s\S]*?>([-+]?\d[\d,.]*)%/i);
        const volumeMatch = row.match(/data-testid-cell="dayvolume"[\s\S]*?>([\d,.]+[KMB]?)/i);

        if (!priceMatch && !percentMatch) continue;

        rows.set(sourceSymbol, {
            price: parseYahooNumber(priceMatch?.[1]),
            changeAbs: parseYahooNumber(changeMatch?.[1]),
            percent: parseYahooNumber(percentMatch?.[1]),
            volume: volumeMatch ? volumeMatch[1].trim() : null,
            sourceDetail: 'yahoo-world-indices-table',
        });
    }

    return rows;
}

async function fetchYahooWorldIndicesMap() {
    try {
        const url = `${YAHOO_WORLD_INDICES_URL}?_=${Date.now()}`;
        return parseYahooWorldIndices(await fetchText(url));
    } catch (error) {
        return new Map();
    }
}

function resolveYahooTableRow(tableMap, market) {
    const candidates = [
        ...(market.yahooTableSymbols || []),
        market.yahooSymbol,
        market.symbol,
    ].map(symbol => String(symbol).toUpperCase());

    for (const key of candidates) {
        if (tableMap.has(key)) return tableMap.get(key);
    }

    return null;
}

function extractYahooQuoteSummary(html) {
    const anchorCandidates = [
        'data-testid="qsp-price"',
        'data-testid="qsp-price-change"',
        'data-testid="qsp-price-change-percent"',
    ];

    let anchor = -1;
    for (const candidate of anchorCandidates) {
        anchor = html.indexOf(candidate);
        if (anchor !== -1) break;
    }

    if (anchor === -1) return null;

    const fragment = html.slice(anchor, anchor + 4000);

    const price = extractYahooQspField(fragment, 'qsp-price');
    const change = extractYahooQspField(fragment, 'qsp-price-change');
    const percent = extractYahooVisiblePercent(fragment);
    const volume = extractYahooQspField(fragment, 'qsp-volume');

    return {
        price,
        change,
        percent,
        volume,
    };
}

function extractRootAppMain(html) {
    const marker = 'root.App.main = ';
    const start = html.indexOf(marker);
    if (start === -1) return null;

    const jsonStart = html.indexOf('{', start);
    if (jsonStart === -1) return null;

    let depth = 0;
    let inString = false;
    let escape = false;

    for (let i = jsonStart; i < html.length; i += 1) {
        const ch = html[i];

        if (escape) {
            escape = false;
            continue;
        }

        if (ch === '\\') {
            if (inString) escape = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            continue;
        }

        if (inString) continue;

        if (ch === '{') depth += 1;
        else if (ch === '}') {
            depth -= 1;
            if (depth === 0) {
                const jsonText = html.slice(jsonStart, i + 1);
                try {
                    return JSON.parse(jsonText);
                } catch (error) {
                    return null;
                }
            }
        }
    }

    return null;
}

function getYahooPriceStore(main) {
    return main?.context?.dispatcher?.stores?.QuoteSummaryStore?.price
        || main?.context?.dispatcher?.stores?.QuoteSummaryStore?.summaryDetail
        || null;
}

async function fetchYahooQuotePage(market) {
    const baseUrl = market.yahooQuoteUrl || `https://finance.yahoo.com/quote/${encodeURIComponent(market.yahooSymbol)}/`;
    const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}_=${Date.now()}`;
    const html = await fetchText(url);
    const htmlHasQsp = html.includes('qsp-price-change-percent') || html.includes('qsp-price-change') || html.includes('qsp-price');
    const htmlHasQuoteSummary = html.includes('qsp-price-change-percent') || html.includes('qsp-price') || html.includes('qsp-price-change');

    const summary = extractYahooQuoteSummary(html);
    const visiblePercent = summary?.percent ?? null;
    const qspPercent = summary?.percent ?? null;
    const qspPrice = summary?.price ?? null;
    const qspChange = summary?.change ?? null;
    const main = extractRootAppMain(html);
    const priceStore = getYahooPriceStore(main);

    const price = qspPrice ?? priceStore?.regularMarketPrice?.raw ?? priceStore?.postMarketPrice?.raw ?? priceStore?.preMarketPrice?.raw ?? null;
    const change = qspChange ?? priceStore?.regularMarketChange?.raw ?? null;
    const percent = qspPercent ?? visiblePercent ?? priceStore?.regularMarketChangePercent?.raw ?? null;
    const volume = summary?.volume ?? priceStore?.regularMarketVolume?.raw ?? null;
    const marketTime = priceStore?.regularMarketTime?.raw ?? null;
    const sourceDetail = qspPercent != null
        ? 'qsp-price-change-percent'
        : (visiblePercent != null ? 'visible-percent-fallback' : (priceStore?.regularMarketChangePercent?.raw != null ? 'root.App.main' : 'unknown'));

    if (price == null && percent == null) {
        const fallbackPrice = extractYahooField(html, 'regularMarketPrice');
        const fallbackChange = extractYahooField(html, 'regularMarketChange');
        const fallbackPercent = extractYahooField(html, 'regularMarketChangePercent');
        const fallbackVolume = extractYahooField(html, 'regularMarketVolume');
        const fallbackMarketTime = extractYahooField(html, 'regularMarketTime');

        if (fallbackPrice != null || fallbackPercent != null) {
            return {
                price: fallbackPrice != null ? Number(fallbackPrice) : null,
                percent: visiblePercent ?? (fallbackPercent != null ? Number(fallbackPercent) : null),
                changeAbs: fallbackChange != null ? Number(fallbackChange) : null,
                volume: fallbackVolume != null ? Number(fallbackVolume) : null,
                asOf: fallbackMarketTime != null ? new Date(Number(fallbackMarketTime) * 1000).toISOString() : null,
                sourceDetail: 'legacy-fallback-fields',
            };
        }

        throw new Error(`Could not parse Yahoo quote page for ${market.yahooSymbol} (htmlLen=${html.length}, qsp=${htmlHasQsp ? 'yes' : 'no'}, quoteSummary=${htmlHasQuoteSummary ? 'yes' : 'no'})`);
    }

    return {
        price: price != null ? Number(price) : null,
        percent: percent != null ? Number(percent) : null,
        changeAbs: change != null ? Number(change) : null,
        volume: volume != null ? Number(volume) : null,
        asOf: marketTime != null ? new Date(Number(marketTime) * 1000).toISOString() : null,
        sourceDetail,
    };
}

async function fetchYahooQuoteMap() {
    try {
        const symbols = MARKETS.map(market => encodeURIComponent(market.yahooSymbol)).join(',');
        const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}&_=${Date.now()}`;
        const json = await fetchJson(url);
        const results = Array.isArray(json?.quoteResponse?.result) ? json.quoteResponse.result : [];
        return new Map(results.map(quote => [quote.symbol, quote]));
    } catch (error) {
        return new Map();
    }
}

function resolveQuote(quoteMap, market) {
    const candidates = [
        market.yahooSymbol,
        market.yahooSymbol.startsWith('^') ? market.yahooSymbol.slice(1) : market.yahooSymbol,
        market.symbol,
    ].filter(Boolean);

    for (const key of candidates) {
        if (quoteMap.has(key)) return quoteMap.get(key);
    }

    return null;
}

async function fetchMarketRow(market, quote = null, tableRow = null) {
    try {
        let price = null;
        let percent = null;
        let volume = null;
        let changeAbs = null;
        let asOf = null;
        let sourceBranch = 'unknown';
        let sourceDetail = null;
        let rawPercent = null;
        let rawPrice = null;
        let rawChange = null;

        try {
            const page = await fetchYahooQuotePage(market);
            price = page.price;
            percent = page.percent;
            changeAbs = page.changeAbs;
            volume = page.volume;
            asOf = page.asOf;
            sourceBranch = 'yahoo-html';
            sourceDetail = page.sourceDetail || 'yahoo-html';
            rawPercent = page.percent;
            rawPrice = page.price;
            rawChange = page.changeAbs;
        } catch (pageError) {
            if (tableRow) {
                price = tableRow.price;
                percent = tableRow.percent;
                changeAbs = tableRow.changeAbs;
                volume = tableRow.volume;
                asOf = null;
                sourceBranch = 'yahoo-world-indices';
                sourceDetail = tableRow.sourceDetail;
                rawPercent = tableRow.percent;
                rawPrice = tableRow.price;
                rawChange = tableRow.changeAbs;
            } else if (quote && Object.keys(quote).length > 0) {
                const prevClose = quote.regularMarketPreviousClose ?? quote.previousClose ?? null;
                price = quote.regularMarketPrice ?? quote.postMarketPrice ?? quote.preMarketPrice ?? quote.previousClose ?? null;
                const change = quote.regularMarketChangePercent;
                const computedPct = price != null && prevClose != null && Number(prevClose) !== 0
                    ? ((Number(price) - Number(prevClose)) / Number(prevClose)) * 100
                    : null;
                percent = Number.isFinite(Number(change)) ? Number(change) : computedPct;
                volume = quote.regularMarketVolume ?? quote.averageDailyVolume3Month ?? null;
                changeAbs = Number.isFinite(Number(quote.regularMarketChange))
                    ? Number(quote.regularMarketChange)
                    : (price != null && prevClose != null ? Number(price) - Number(prevClose) : null);
                asOf = quote.regularMarketTime ? new Date(quote.regularMarketTime * 1000).toISOString() : null;
                sourceBranch = 'quote-api-fallback';
                sourceDetail = 'quote-api-fallback-empty';
                rawPercent = quote.regularMarketChangePercent ?? null;
                rawPrice = quote.regularMarketPrice ?? null;
                rawChange = quote.regularMarketChange ?? null;
            } else {
                const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(market.yahooSymbol)}?interval=1m&range=1d&_=${Date.now()}`;
                const json = await fetchJson(url);
                const result = json?.chart?.result?.[0];
                const meta = result?.meta || {};

                price = meta.regularMarketPrice ?? meta.previousClose ?? null;
                const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
                const change = meta.regularMarketChangePercent;
                const computedPct = price != null && prevClose != null && Number(prevClose) !== 0
                    ? ((Number(price) - Number(prevClose)) / Number(prevClose)) * 100
                    : null;
                percent = Number.isFinite(Number(change)) ? Number(change) : computedPct;
                volume = meta.regularMarketVolume ?? meta.volume ?? null;
                changeAbs = Number.isFinite(Number(meta.regularMarketChange))
                    ? Number(meta.regularMarketChange)
                    : (price != null && prevClose != null ? Number(price) - Number(prevClose) : null);
                asOf = meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : null;
                sourceBranch = 'chart-fallback';
                sourceDetail = 'chart-fallback (quote-api empty)';
                rawPercent = meta.regularMarketChangePercent ?? null;
                rawPrice = meta.regularMarketPrice ?? null;
                rawChange = meta.regularMarketChange ?? null;
            }
        }

        if (DEBUG) {
            console.log(
                `[world-index] ${market.symbol} branch=${sourceBranch}` +
                ` rawPrice=${rawPrice ?? 'null'}` +
                ` rawChange=${rawChange ?? 'null'}` +
                ` rawPercent=${rawPercent ?? 'null'}` +
                ` finalPercent=${percent ?? 'null'}` +
                ` finalPrice=${price ?? 'null'}` +
                ` asOf=${asOf ?? 'null'}`
            );
        }

        const chart1m = await fetchChart1M(market.yahooSymbol);

        return {
            symbol: market.symbol,
            name: market.name,
            price: formatNumber(price),
            percent_change: formatPercent(percent),
            change: formatSignedNumber(changeAbs),
            volume: typeof volume === 'string' ? volume : formatVolume(volume),
            icon: market.icon,
            accent: market.accent,
            chart_url: market.chartUrl,
            yahoo_chart_url: market.yahooChartUrl || null,
            chart_1m: chart1m,
            source_symbol: market.yahooSymbol,
            source: 'Yahoo Finance quote page',
            source_detail: sourceDetail,
            as_of: asOf,
        };
    } catch (error) {
        return {
            symbol: market.symbol,
            name: market.name,
            price: 'N/A',
            percent_change: 'N/A',
            change: 'N/A',
            volume: 'N/A',
            icon: market.icon,
            accent: market.accent,
            chart_url: market.chartUrl,
            yahoo_chart_url: market.yahooChartUrl || null,
            chart_1m: null,
            source_symbol: market.yahooSymbol,
            source: 'Yahoo Finance quote page',
            source_detail: sourceDetail,
            error: error.message,
        };
    }
}

async function handleApiWorldStocks(res) {
    const [tableMap, quoteMap] = await Promise.all([
        fetchYahooWorldIndicesMap().catch(() => new Map()),
        fetchYahooQuoteMap().catch(() => new Map()),
    ]);

    const markets = await Promise.all(MARKETS.map(market => (
        fetchMarketRow(market, resolveQuote(quoteMap, market), resolveYahooTableRow(tableMap, market))
    )));
    const payload = {
        as_of: new Date().toISOString(),
        source_as_of: markets.map(m => m.as_of).filter(Boolean).sort().at(-1) || null,
        markets,
    };

    if (DEBUG) {
        console.log(
            `[world-index] refreshed ${payload.markets.length} rows at ${payload.as_of}` +
            (payload.source_as_of ? ` (Yahoo source ${payload.source_as_of})` : '') +
            ` tableRows=${tableMap.size}` +
            ` sources=${markets.map(m => `${m.symbol}:${m.source_detail || 'none'}`).join(',')}`
        );
    } else {
        console.log(`[world-index] refreshed ${payload.markets.length} rows at ${payload.as_of}`);
    }

    res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Access-Control-Allow-Origin': '*',
    });
    res.end(JSON.stringify(payload));
}

function serveHtml(res) {
    fs.readFile(HTML_FILE, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end(`Cannot read worldindex.html: ${err.message}`);
            return;
        }

        res.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0',
        });
        res.end(data);
    });
}

function normalizePath(url) {
    let p = decodeURIComponent((url || '/').split('?')[0]);
    if (!p || p === '') p = '/';
    if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
    return p;
}

const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.writeHead(204);
        res.end();
        return;
    }

    const urlPath = normalizePath(req.url);

    if (urlPath === '/' || urlPath === '/index.html' || urlPath === '/worldindex.html') {
        serveHtml(res);
        return;
    }

    if (urlPath === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
    }

        if (urlPath === '/api/world-stocks' || urlPath === '/api/world' || urlPath === '/world-api') {
        handleApiWorldStocks(res).catch(error => {
            console.error('API error:', error);
            res.writeHead(500, {
                'Content-Type': 'application/json; charset=utf-8',
                'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Access-Control-Allow-Origin': '*',
            });
            res.end(JSON.stringify({ error: error.message }));
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Not Found', path: urlPath }));
});

server.listen(PORT, () => {
    console.log(`World index server running at http://localhost:${PORT}/worldindex.html`);
    console.log(`API: http://localhost:${PORT}/api/world-stocks`);
}).on('error', err => {
    console.error(err);
    process.exit(1);
});
