export interface PaymentData {
	userId: string;
	guildId: string | null;
	credits: number | null;
	type: "subscription" | "plan";
	location: "guild" | "user";
}