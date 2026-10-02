import { z } from "zod";

/** 利用者の氏名は、前後空白を除いて必須・60文字以内。 */
export const userNameSchema = z.string().trim().min(1, "氏名を入力してください").max(60);
