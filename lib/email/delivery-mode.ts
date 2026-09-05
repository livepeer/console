import { EmailProviderError } from "./provider";
/** Preview must explicitly enable transactional mail; Contacts stays isolated. */
export function isCaptureDelivery(channel: "email" | "newsletter" = "email") {
  if (process.env.VERCEL_ENV === "preview") {
    if (process.env.EMAIL_DELIVERY_MODE === "capture") return true;
    if (process.env.EMAIL_DELIVERY_MODE === "send_transactional")
      return channel === "newsletter";
    throw new EmailProviderError(
      "Preview delivery is not isolated",
      false,
      "preview_delivery_unconfigured"
    );
  }
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.EMAIL_DELIVERY_MODE === "capture"
  );
}
