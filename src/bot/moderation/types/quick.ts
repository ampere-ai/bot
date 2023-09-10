import type { Duration } from "dayjs/plugin/duration.js";

import dayjsRelativeTime from "dayjs/plugin/relativeTime.js";
import dayjsDuration from "dayjs/plugin/duration.js";
import dayjs from "dayjs";

dayjs.extend(dayjsRelativeTime);
dayjs.extend(dayjsDuration);

interface QuickAction {
    reason: string;
    action?: "ban" | "warn" | "unban";
    duration?: Duration;
}

export const QUICK_ACTIONS: QuickAction[] = [
	/* Exclusive warnings */
	{ reason: "This is your only warning", action: "warn" },
	{ reason: "This is your last warning", action: "warn" },

	/* Both warning & ban reasons */
	{ reason: "Inappropriate use of the bot" },
	{ reason: "If you need help, talk to someone that cares for you" },
	{ reason: "Sexual content involving minors" },
	{ reason: "Gore/violent content" },
	{ reason: "Incest-related content" },
	{ reason: "Trolling" },
	{ reason: "Tricking bot into generating inappropriate content" },
	{ reason: "Using bot to generate inappropriate content" },

	/* Warning reasons & timed ban reasons */
	{ reason: "Joking about self-harm/suicide", duration: dayjs.duration({ days: 3 }) },
	{ reason: "Self-harm/suicide-related content", duration: dayjs.duration({ days: 7 }) },
	{ reason: "Sexual content", duration: dayjs.duration({ days: 7 }) },
	{ reason: "Racist content", duration: dayjs.duration({ days: 7 }) },

	/* Un-ban reasons */
	{ reason: "Appealed", action: "unban" },
	{ reason: "False ban", action: "unban" }
];