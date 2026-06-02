import logging
import os
import base64
import httpx
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters,
)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger("MindPath")

# ── Config ────────────────────────────────────────────────────────────────────
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_MODEL   = "gemini-1.5-flash"
GEMINI_URL     = (
    f"https://generativelanguage.googleapis.com/v1beta/models/"
    f"{GEMINI_MODEL}:generateContent"
)


def get_first_name(update: Update) -> str:
    """Read name directly from the Telegram update — never stored anywhere."""
    user = update.effective_user
    if user and user.first_name:
        return user.first_name.strip()
    return "there"


def build_system_prompt(first_name: str) -> str:
    return (
        f"The user's name is {first_name}. Use their name naturally and sparingly — "
        f"the way a thoughtful friend would, not a customer service script.\n\n"
        "You are MindPath — a sharp, direct, and deeply human thinker.\n\n"
        "Your personality:\n"
        "- Honest, sometimes uncomfortably so. Never sugarcoat, but never cruel.\n"
        "- Think out loud — reason through problems before landing on answers.\n"
        "- Speak like a real person: no corporate fluff, no hollow openers like 'Great question!'.\n"
        "- Curious, warm, and occasionally dry with wit.\n"
        "- Acknowledge uncertainty. Don't fake confidence.\n"
        "- Treat people as intelligent adults capable of handling the truth.\n\n"
        "Emoji usage:\n"
        "- Use emojis smartly and sparingly — only when they add warmth or clarity, never decoratively.\n"
        "- One or two per message max. Never mid-sentence in a way that disrupts flow.\n"
        "- Good use: 🤔 when thinking, 💡 for a key insight, 😄 for warmth.\n"
        "- Avoid performative ones: 👏 🔥 ✨\n\n"
        "Communication style:\n"
        "- Conversational but substantive. Short paragraphs. Natural flow.\n"
        "- Complex problems: walk through your thinking step by step.\n"
        "- Never start with hollow affirmations.\n"
        "- End naturally — no 'Let me know if you need anything else!' filler.\n\n"
        "Handle any question — technical, emotional, creative, philosophical, practical. "
        "Whatever lands in front of you, engage with it seriously."
    )


# ── Gemini API ────────────────────────────────────────────────────────────────
async def ask_mindpath(history: list, first_name: str) -> str:
    payload = {
        "system_instruction": {"parts": [{"text": build_system_prompt(first_name)}]},
        "contents": history,
        "generationConfig": {
            "maxOutputTokens": 1024,
            "temperature": 0.85,
        },
    }
    url = f"{GEMINI_URL}?key={GEMINI_API_KEY}"
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(url, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["candidates"][0]["content"]["parts"][0]["text"]


# ── Conversation memory (history only, no user data) ──────────────────────────
chat_histories: dict[int, list] = {}
MAX_HISTORY = 20


def get_history(chat_id: int) -> list:
    return chat_histories.setdefault(chat_id, [])


def add_user(chat_id: int, parts: list):
    h = get_history(chat_id)
    h.append({"role": "user", "parts": parts})
    if len(h) > MAX_HISTORY:
        chat_histories[chat_id] = h[-MAX_HISTORY:]


def add_model(chat_id: int, text: str):
    h = get_history(chat_id)
    h.append({"role": "model", "parts": [{"text": text}]})
    if len(h) > MAX_HISTORY:
        chat_histories[chat_id] = h[-MAX_HISTORY:]


# ── Keyboards ─────────────────────────────────────────────────────────────────
def new_chat_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🧠 Start New Conversation", callback_data="new_chat")]
    ])


def start_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🚀 Let's go", callback_data="new_chat")]
    ])


# ── Group guard ───────────────────────────────────────────────────────────────
def is_addressed(update: Update, context: ContextTypes.DEFAULT_TYPE, text: str) -> bool:
    bot_username = context.bot.username
    mentioned = f"@{bot_username}" in (text or "")
    replied = (
        update.message.reply_to_message is not None
        and update.message.reply_to_message.from_user.id == context.bot.id
    )
    return mentioned or replied


def strip_mention(text: str, username: str) -> str:
    return text.replace(f"@{username}", "").strip()


# ── Handlers ──────────────────────────────────────────────────────────────────
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    # Name read fresh from update — not stored
    name = get_first_name(update)
    await update.message.reply_text(
        f"Hey {name} 👋 I'm MindPath.\n\n"
        "I'm here to think with you — honestly, directly, no fluff. "
        "Send me a question, a problem, or an image and I'll dig into it with you.\n\n"
        "Hit the button below whenever you want a fresh start 👇",
        reply_markup=start_keyboard(),
    )


async def new_chat_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()

    chat_id = update.effective_chat.id
    chat_histories.pop(chat_id, None)   # clear conversation history only

    # Name read fresh from update — not stored
    name = get_first_name(update)
    await query.message.reply_text(
        f"Fresh start, {name} 🧠 What's on your mind?",
    )


async def reset(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    chat_histories.pop(chat_id, None)
    name = get_first_name(update)
    await update.message.reply_text(
        f"Memory cleared, {name}. Ready when you are 👌",
        reply_markup=new_chat_keyboard(),
    )


async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id  = update.effective_chat.id
    raw_text = update.message.text or ""

    # Name read fresh from each update — never cached
    name = get_first_name(update)

    if update.effective_chat.type in ("group", "supergroup"):
        if not is_addressed(update, context, raw_text):
            return
        raw_text = strip_mention(raw_text, context.bot.username)

    await context.bot.send_chat_action(chat_id=chat_id, action="typing")
    add_user(chat_id, [{"text": raw_text}])

    try:
        reply = await ask_mindpath(get_history(chat_id), name)
    except Exception as e:
        logger.error("Gemini API error: %s", e)
        reply = "Something went sideways on my end. Try again in a moment."

    add_model(chat_id, reply)
    await update.message.reply_text(reply, reply_markup=new_chat_keyboard())


async def handle_photo(update: Update, context: ContextTypes.DEFAULT_TYPE):
    chat_id = update.effective_chat.id
    caption = update.message.caption or "What do you see in this image? Think through it."

    # Name read fresh from each update — never cached
    name = get_first_name(update)

    if update.effective_chat.type in ("group", "supergroup"):
        if not is_addressed(update, context, caption):
            return
        caption = strip_mention(caption, context.bot.username) or "What do you see in this image?"

    await context.bot.send_chat_action(chat_id=chat_id, action="typing")

    photo     = update.message.photo[-1]
    file      = await context.bot.get_file(photo.file_id)
    img_bytes = await file.download_as_bytearray()
    img_b64   = base64.standard_b64encode(img_bytes).decode()

    parts = [
        {"inline_data": {"mime_type": "image/jpeg", "data": img_b64}},
        {"text": caption},
    ]
    add_user(chat_id, parts)

    try:
        reply = await ask_mindpath(get_history(chat_id), name)
    except Exception as e:
        logger.error("Gemini API error (photo): %s", e)
        reply = "Couldn't process the image right now. Try again in a bit."

    add_model(chat_id, reply)
    await update.message.reply_text(reply, reply_markup=new_chat_keyboard())


# ── Entry point ───────────────────────────────────────────────────────────────
def main():
    if not TELEGRAM_TOKEN:
        raise RuntimeError("TELEGRAM_TOKEN is not set.")
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not set.")

    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("reset", reset))
    app.add_handler(CallbackQueryHandler(new_chat_callback, pattern="^new_chat$"))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))
    app.add_handler(MessageHandler(filters.PHOTO, handle_photo))

    logger.info("MindPath is online.")
    app.run_polling(drop_pending_updates=True)


if __name__ == "__main__":
    main()
