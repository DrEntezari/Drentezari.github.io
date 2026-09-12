require("dotenv").config();

const express = require("express");
const path = require("path");

const app = express();

const PORT = process.env.PORT || 3000;

/* =====================================================
   ENVIRONMENT VARIABLES
===================================================== */

if (!process.env.TELEGRAM_BOT_TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN تنظیم نشده است.");
  process.exit(1);
}

if (!process.env.TELEGRAM_CHAT_ID) {
  console.error("❌ TELEGRAM_CHAT_ID تنظیم نشده است.");
  process.exit(1);
}


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
  express.json({
    limit: "10kb"
  })
);


/*
  فایل‌های frontend
*/
app.use(
  express.static(
    path.join(__dirname, "public")
  )
);


/* =====================================================
   RATE LIMIT
===================================================== */

const requestLog = new Map();

const RATE_LIMIT_WINDOW =
  60 * 1000;

const MAX_REQUESTS = 5;


function rateLimit(
  req,
  res,
  next
) {

  const ip =
    req.headers["x-forwarded-for"]
      ?.split(",")[0]
      ?.trim() ||
    req.socket.remoteAddress ||
    "unknown";


  const now =
    Date.now();


  const previous =
    requestLog.get(ip);


  if (
    !previous ||
    now - previous.start >
      RATE_LIMIT_WINDOW
  ) {

    requestLog.set(
      ip,
      {
        start: now,
        count: 1
      }
    );

    return next();
  }


  previous.count++;


  if (
    previous.count >
    MAX_REQUESTS
  ) {

    return res.status(429).json({

      success: false,

      message:
        "تعداد درخواست‌ها زیاد است. لطفاً کمی بعد دوباره تلاش کنید."

    });

  }


  next();

}


/* =====================================================
   TEXT VALIDATION
===================================================== */

function cleanText(
  value,
  maxLength
) {

  if (
    typeof value !== "string"
  ) {

    return null;

  }


  const text =
    value.trim();


  if (
    !text ||
    text.length >
      maxLength
  ) {

    return null;

  }


  return text;

}


/* =====================================================
   TELEGRAM API
===================================================== */

app.post(
  "/api/send-telegram",
  rateLimit,
  async (req, res) => {

    try {

      /* ---------------------------------------------
         دریافت اطلاعات
      --------------------------------------------- */

      const fullName =
        cleanText(
          req.body.fullName,
          100
        );


      const phone =
        cleanText(
          req.body.phone,
          30
        );


      const gender =
        cleanText(
          req.body.gender,
          20
        );


      const grade =
        cleanText(
          req.body.grade,
          30
        );


      const major =
        cleanText(
          req.body.major,
          50
        );


      /* ---------------------------------------------
         بررسی اطلاعات
      --------------------------------------------- */

      if (
        !fullName ||
        !phone ||
        !gender ||
        !grade ||
        !major
      ) {

        return res.status(400).json({

          success: false,

          message:
            "اطلاعات واردشده معتبر نیست."

        });

      }


      /* ---------------------------------------------
         بررسی جنسیت
      --------------------------------------------- */

      const allowedGenders = [
        "دختر",
        "پسر"
      ];


      if (
        !allowedGenders.includes(
          gender
        )
      ) {

        return res.status(400).json({

          success: false,

          message:
            "جنسیت واردشده معتبر نیست."

        });

      }


      /* ---------------------------------------------
         ساخت پیام تلگرام
      --------------------------------------------- */

      const message = `⚡ ورود جدید به فرمول‌نامه

👤 نام و نام خانوادگی: ${fullName}
📱 موبایل: ${phone}
⚧ جنسیت: ${gender}
🎓 پایه: ${grade}
📚 رشته: ${major}`;


      /* ---------------------------------------------
         ارسال به Telegram
      --------------------------------------------- */

      const controller =
        new AbortController();


      const timeout =
        setTimeout(
          () => controller.abort(),
          10000
        );


      let response;


      try {

        response =
          await fetch(
            `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`,
            {

              method: "POST",

              headers: {
                "Content-Type":
                  "application/json"
              },

              body: JSON.stringify({

                chat_id:
                  process.env.TELEGRAM_CHAT_ID,

                text:
                  message

              }),

              signal:
                controller.signal

            }
          );

      } finally {

        clearTimeout(
          timeout
        );

      }


      /* ---------------------------------------------
         پاسخ Telegram
      --------------------------------------------- */

      const result =
        await response.json();


      if (
        !response.ok ||
        !result.ok
      ) {

        console.error(
          "Telegram API Error:",
          result?.description ||
          "Unknown error"
        );


        return res.status(500).json({

          success: false,

          message:
            "ارسال پیام انجام نشد."

        });

      }


      /* ---------------------------------------------
         موفق
      --------------------------------------------- */

      console.log(
        `✅ Telegram message sent for ${fullName}`
      );


      return res.json({

        success: true

      });

    }


    /* ---------------------------------------------
       خطای سرور
    --------------------------------------------- */

    catch (error) {

      if (
        error.name ===
        "AbortError"
      ) {

        console.error(
          "❌ Telegram request timeout"
        );

      } else {

        console.error(
          "❌ Server Error:",
          error.message
        );

      }


      return res.status(500).json({

        success: false,

        message:
          "خطایی در سرور رخ داد."

      });

    }

  }
);


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
  "/api/health",
  (req, res) => {

    res.json({

      success: true,

      message:
        "Physics Formula API is running."

    });

  }
);


/* =====================================================
   START SERVER
===================================================== */

app.listen(
  PORT,
  () => {

    console.log(
      `Physics Formula API running on port ${PORT}`
    );

  }
);
