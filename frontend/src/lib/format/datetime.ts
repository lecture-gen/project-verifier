// Backend 는 UTC ISO 문자열을 그대로 보낸다.
// 운영자는 한국 시각으로 시간을 보고 싶으므로 표시 시점에 Asia/Seoul 로 강제 변환한다.
// 표면 패치 (+9 더하기) 가 아니라 timezone 인식 포맷터를 사용한다.

const KST_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatKstDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return KST_FORMATTER.format(date);
}
