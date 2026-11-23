import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export const fmtTime = (v?: string | null) => (v ? dayjs(v).format("D MMM YYYY, HH:mm:ss") : "—");
export const fmtAgo = (v?: string | null) => (v ? dayjs(v).fromNow() : "never");
export { dayjs };
