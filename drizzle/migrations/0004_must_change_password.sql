-- 発行時の仮パスワードのまま使っている利用者に、変更をお願いし続けるための印。
-- 管理者がアカウントを発行するとき（本人が決めていないパスワードを渡すとき）に立てる。
-- 既存の利用者は自分でパスワードを決めた前提なので 0（不要）のままにする。
ALTER TABLE `users` ADD `must_change_password` integer DEFAULT 0 NOT NULL;
