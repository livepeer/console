import { EmailProviderError } from "./provider";
/** Preview can never contact the production sending or audience providers. */
export function isCaptureDelivery() {
  if (process.env.VERCEL_ENV === "preview") {
    if (process.env.EMAIL_DELIVERY_MODE !== "capture")
      throw new EmailProviderError(
        "Preview delivery is not isolated",
        false,
        "preview_delivery_unconfigured"
      );
    return true;
  }
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.EMAIL_DELIVERY_MODE === "capture"
  );
}
