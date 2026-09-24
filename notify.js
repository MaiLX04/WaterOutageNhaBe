require('dotenv').config();
const axios = require("axios");
const fs = require("fs");

// Bypass SSL verification — capnuocnhabe.vn has an incomplete certificate chain
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;
const URL = process.env.URL;
const KEYWORDS = process.env.KEYWORDS;
const CHECK_WINDOW_HOURS = Number(process.env.CHECK_WINDOW_HOURS);
const PROXY_URL = process.env.PROXY_URL;
const CACHE_FILE = "cache/sent.json";   // define the cache file path

function loadSent() {
    if (fs.existsSync(CACHE_FILE)) {
        try {
            const data = fs.readFileSync(CACHE_FILE, "utf8");
            if (data.trim()) {
                return JSON.parse(data);
            }
        } catch (err) {
            console.error("Cache file corrupted, resetting:", err.message);
        }
    }
    return []; // fallback to empty list
}

function saveSent(sentIds) {
    fs.mkdirSync("cache", { recursive: true });
    // keep only the last 10 IDs
    const trimmed = sentIds.slice(-10);
    fs.writeFileSync(CACHE_FILE, JSON.stringify(trimmed, null, 2));
}

function stripHtml(html) {
    return html
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim();
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

        let axiosConfig = { timeout: 30000 };
        if (PROXY_URL) {
            console.log(`Using proxy: ${PROXY_URL}`);
            if (PROXY_URL.startsWith('socks')) {
                const { SocksProxyAgent } = await import("socks-proxy-agent");
                const agent = new SocksProxyAgent(PROXY_URL);
                axiosConfig.httpsAgent = agent;
                axiosConfig.httpAgent = agent;
            } else if (PROXY_URL.startsWith('http')) {
                const { HttpsProxyAgent } = await import("https-proxy-agent");
                const agent = new HttpsProxyAgent(PROXY_URL);
                axiosConfig.httpsAgent = agent;
                axiosConfig.httpAgent = agent;
            }
        }

        const response = await axios.get(URL, axiosConfig);
        const posts = response.data?.items;
        if (!Array.isArray(posts)) {
            console.error("Invalid response format. Expected { items: [...] }.");
            process.exit(1);
        }
        console.log(`Fetched ${posts.length} latest posts.`);
        let matchCount = 0;
        for (const post of posts) {
            if (sentIds.includes(post.IdBaiViet)) {
                console.log(`  -> Skipping (already sent): ${post.TieuDe}`);
                continue;
            }
            const title = post.TieuDe || "";
            const content = stripHtml(post.NoiDung || "");
            const postDate = new Date(post.NgayDang);
            const now = new Date();

            // Calculate post age in hours
            const ageInHours = (now - postDate) / (1000 * 60 * 60);
            console.log(`- Post: "${title}" | Published: ${post.NgayDang} | Age: ${ageInHours.toFixed(2)} hours`);
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

                // Build detail link: prefer PDF attachment, fallback to main page
                const detailUrl = post.Files?.[0]
                    ? `https://capnuocnhabe.vn${post.Files[0].DuongDan}`
                    : 'https://capnuocnhabe.vn/KhachHang/ThongBaoCupNuoc';

                const message = `🔔 <b>PHÁT HIỆN THÔNG BÁO CÚP NƯỚC!</b>\n\n` +
                    `📌 <b>Tiêu đề:</b> ${title}\n` +
                    `⏰ <b>Thời gian đăng:</b> ${postDate.toLocaleString('vi-VN')}\n` +
                    `🔑 <b>Từ khóa khớp:</b> ${matchedKeywords.join(", ")}\n\n` +
                    `🔗 <b>Xem chi tiết tại:</b> <a href="${detailUrl}">Website Cấp nước Nhà Bè</a>`;

                await sendMessage(message);
                console.log("  -> Telegram notification sent.");
                sentIds.push(post.IdBaiViet);
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
        } else if (PROXY_URL && (err.code === 'ECONNREFUSED' || err.code === 'ETIMEDOUT' || err.code === 'ECONNRESET' || err.message.includes('timeout'))) {
            console.log("Proxy/Network error detected. Sending Telegram alert...");
            const alertMsg = `⚠️ <b>LỖI PROXY!</b>\n\nKhông thể kết nối đến web Cấp nước Nhà Bè. Proxy hiện tại (<code>${PROXY_URL}</code>) có thể đã chết (Timeout/Connection Refused).\n\nVui lòng tìm SOCKS5 Proxy Việt Nam mới và cập nhật Github Secret <b>PROXY_URL</b>.`;
            try {
                await sendMessage(alertMsg);
            } catch (alertErr) {
                console.error("Failed to send proxy alert:", alertErr.message);
            }
        }
        process.exit(1);
    }
}
checkSite();