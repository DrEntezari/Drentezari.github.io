require("dotenv").config();

const express = require("express");

const app = express();

const PORT = process.env.PORT || 10000;
const ALLOWED_ORIGIN =
  process.env.ALLOWED_ORIGIN || "https://drenTezari.github.io";

app.use(express.json({ limit: "10kb" }));

// CORS
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin === ALLOWED_ORIGIN) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "POST, GET, OPTIONS"
  );

  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type"
  );

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

// محدودیت ساده درخواست
const requests = new Map();

const WINDOW = 60 * 1000;
const MAX_REQUESTS = 5;

function rateLimit(req, res, next) {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  const now = Date.now();
  const old = requests.get(ip);

  if (!old || now - old.time > WINDOW) {
    requests.set(ip, {
      time: now,
      count: 1
    });

    return next();
  }

  old.count++;

  if (old.count > MAX_REQUESTS) {
    return res.status(429).json({
      success: false,
      message: "تعداد درخواست‌ها زیاد است. کمی بعد دوباره تلاش کنید."
    });
  }

  next();
}

function cleanText(value, maxLength) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (!text || text.length > maxLength) {
    return null;
  }

  return text;
}

// تست سرور
app.get("/", (req, res) => {
  res.json({
    ok: true,
    service: "Physics Formula API"
  });
});

app.get("/health", (req, res) => {
  res.json({
    ok: true
  });
});

// ارسال اطلاعات به تلگرام
app.post(
  "/api/send-telegram",
  rateLimit,
  async (req, res) => {

    try {

      const firstName =
        cleanText(req.body.firstName, 50);

      const fullName =
        cleanText(req.body.fullName, 100);

      const phone =
        cleanText(req.body.phone, 30);

      const grade =
        cleanText(req.body.grade, 30);

      const major =
        cleanText(req.body.major, 50);

      if (
        !firstName ||
        !fullName ||
        !phone ||
        !grade ||
        !major
      ) {

        return res.status(400).json({
          success: false,
          message: "اطلاعات واردشده معتبر نیست."
        });

      }

      const message =
`⚡ ورود جدید به فرمول‌نامه

👤 نام: ${firstName}
📝 نام و نام خانوادگی: ${fullName}
📱 موبایل: ${phone}
🎓 پایه: ${grade}
📚 رشته: ${major}`;

      const controller =
        new AbortController();

      const timeout =
        setTimeout(
          () => controller.abort(),
          10000
        );

      let response;

      try {

        response = await fetch(
          `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
          {
            method: "POST",

            headers: {
              "Content-Type": "application/json"
            },

            body: JSON.stringify({
              chat_id:
                process.env.TELEGRAM_CHAT_ID,

              text: message
            }),

            signal: controller.signal
          }
        );

      } finally {

        clearTimeout(timeout);

      }

      const result =
        await response.json();

      if (
        !response.ok ||
        !result.ok
      ) {

        console.error(
          "Telegram error:",
          result?.description || "Unknown error"
        );

        return res.status(500).json({
          success: false,
          message: "ارسال پیام انجام نشد."
        });

      }

      return res.json({
        success: true
      });

    } catch (error) {

      console.error(
        "Server error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "خطای سرور."
      });

    }

  }
);

app.listen(
  PORT,
  "0.0.0.0",
  () => {

    console.log(
      `Physics Formula API running on port ${PORT}`
    );

  }
);
