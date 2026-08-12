require('dotenv').config();
const axios = require("axios");
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const URL = process.env.URL || "https://capnuocnhabe.vn/wp-json/wp/v2/posts?categories=34&per_page=5";
const KEYWORDS = process.env.KEYWORDS || "Phước Kiển, Lê Văn Lương";
const CHECK_WINDOW_HOURS = Number(process.env.CHECK_WINDOW_HOURS) || 24;

function loadSent() {
    if (fs.existsSync(CACHE_FILE)) {
        return JSON.parse(fs.readFileSync(CACHE_FILE, "utf8"));
    }
    return [];
}

function saveSent(sentIds) {
    fs.mkdirSync("cache", { recursive: true });
    // keep only the last 10 IDs
    const trimmed = sentIds.slice(-10);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(trimmed));
}

function cleanTitle(titleText) {
    return titleText
        .replace(/&#8211;/g, "–")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}
async function sendMessage(msg) {
    const apiUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await axios.post(apiUrl, {
        chat_id: CHAT_ID,
        text: msg,
        parse_mode: 'HTML',
        disable_web_page_preview: false
    });
}
async function checkSite() {
    if (!BOT_TOKEN || !CHAT_ID) {
        console.error("Error: BOT_TOKEN or CHAT_ID is not configured in environment variables.");
        process.exit(1);
    }
    const keywordsList = KEYWORDS.split(",")
        .map(k => k.trim())
        .filter(Boolean);
    console.log(`Checking site: ${URL}`);
    console.log(`Keywords list: [${keywordsList.join(", ")}]`);
    console.log(`Check window: last ${CHECK_WINDOW_HOURS} hours`);
    try {
        const sentIds = loadSent();
        const response = await axios.get(URL);
        const posts = response.data;
        if (!Array.isArray(posts)) {
            console.error("Invalid response format. Expected an array of posts.");
            return;
        }
        console.log(`Fetched ${posts.length} latest posts.`);
        let matchCount = 0;
        for (const post of posts) {
            if (sentIds.includes(post.id)) {
                console.log(`  -> Skipping (already sent): ${post.title.rendered}`);
                continue;
            }
            const title = cleanTitle(post.title?.rendered || "");
            const content = post.content?.rendered || "";
            const postDateGmt = post.date_gmt ? new Date(post.date_gmt + "Z") : new Date(post.date);
            const now = new Date();

            // Calculate post age in hours
            const ageInHours = (now - postDateGmt) / (1000 * 60 * 60);
            console.log(`- Post: "${title}" | Published: ${post.date} | Age: ${ageInHours.toFixed(2)} hours`);
            if (ageInHours > CHECK_WINDOW_HOURS) {
                console.log("  -> Skipped (outside time window)");
                continue;
            }
            // Perform case-insensitive search
            const textToSearch = `${title} ${content}`.toLowerCase();
            const matchedKeywords = keywordsList.filter(keyword =>
                textToSearch.includes(keyword.toLowerCase())
            );
            if (matchedKeywords.length > 0) {
                console.log(`  -> Match found! Keywords: ${matchedKeywords.join(", ")}`);

                const message = `🔔 <b>PHÁT HIỆN THÔNG BÁO CÚP NƯỚC!</b>\n\n` +
                    `📌 <b>Tiêu đề:</b> ${title}\n` +
                    `⏰ <b>Thời gian đăng:</b> ${new Date(post.date).toLocaleString('vi-VN')}\n` +
                    `🔑 <b>Từ khóa khớp:</b> ${matchedKeywords.join(", ")}\n\n` +
                    `🔗 <b>Xem chi tiết tại:</b> <a href="${post.link}">Website Cấp nước Nhà Bè</a>`;

                await sendMessage(message);
                console.log("  -> Telegram notification sent.");
                sentIds.push(post.id);
                matchCount++;
            } else {
                console.log("  -> No keyword match.");
            }
        }
        saveSent(sentIds);
        console.log(`Finished checking. Sent ${matchCount} notifications.`);
    } catch (err) {
        console.error("Error checking site or sending notifications:", err.message);
        if (err.response) {
            console.error("Response data:", err.response.data);
        }
    }
}
checkSite();