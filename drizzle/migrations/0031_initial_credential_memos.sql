-- 初期パスワードの控え（暗号文だけを持つ。平文は保存しない）。
-- 鍵は Workers の秘密の値 CREDENTIAL_ENC_KEY にだけ置く（src/lib/credential-vault.ts）。
CREATE TABLE `initial_credential_memos` (
	`user_id` text PRIMARY KEY NOT NULL,
	`ciphertext` text NOT NULL,
	`iv` text NOT NULL,
	`key_version` text NOT NULL,
	`issued_by` text,
	`issued_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
