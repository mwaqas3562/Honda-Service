import { ReminderType } from "@/generated/prisma/client";

const BOOKING_LINK = process.env.BOOKING_LINK || "https://danishhondapalace.com/book";
const BRAND = "Danish Honda Palace";

export function getMessageContent(
  type: ReminderType,
  customerName: string,
  bikeModel: string
): string {
  const name = customerName || "Customer";
  const bike = bikeModel || "your bike";

  switch (type) {
    case "engine_tuning":
      return `Hi ${name}! Your ${bike} is due for an Engine Tuning. Visit ${BRAND} to keep it running smooth. Book now: ${BOOKING_LINK}`;

    case "oil_change":
      return `Hello ${name}! It's time for an Oil Change for your ${bike}. Drop by ${BRAND}. Schedule here: ${BOOKING_LINK}`;

    case "missed_visit":
      return `Hi ${name}! You missed your scheduled service for ${bike}. Keep it in top shape at ${BRAND}. Book today: ${BOOKING_LINK}`;

    case "comeback":
      return `Hello ${name}! It's been a while since your last service. Visit ${BRAND} and get your ${bike} checked. Book now: ${BOOKING_LINK}`;

    default:
      return `Hi ${name}! Visit ${BRAND} for your next service. Book now: ${BOOKING_LINK}`;
  }
}
