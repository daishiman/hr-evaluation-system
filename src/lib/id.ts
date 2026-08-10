/** 主キーの採番。接頭辞で「どのテーブルのIDか」がログから読めるようにする。 */
export function newId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}
