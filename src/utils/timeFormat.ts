/** 초(seconds)를 "OO분 OO초" 형태로 변환 */
export function formatSeconds(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}분 ${s}초`;
}
