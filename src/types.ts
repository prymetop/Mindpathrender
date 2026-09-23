export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
  OWNER_TELEGRAM_ID: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  AUTHORIZED_DRIVE_ROOT_ID?: string;
  MONITORED_CHANNEL_IDS?: string;
}

export interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  title?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: TelegramChat;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  text?: string;
  caption?: string;
  photo?: Array<{ file_id: string; width: number; height: number; file_size?: number }>;
  date?: number;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  callback_query?: {
    id: string;
    from: TelegramUser;
    data?: string;
    message?: TelegramMessage;
  };
}

export interface ChatTurn {
  role: "user" | "model";
  parts: Array<Record<string, unknown>>;
}

export interface AIProvider {
  generate(input: {
    history: ChatTurn[];
    firstName: string;
    userText?: string;
    image?: { mimeType: string; dataBase64: string };
  }): Promise<string>;
}
