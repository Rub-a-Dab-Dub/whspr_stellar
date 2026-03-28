export function parseDeepLink(link: string) {
  try {
    const url = new URL(link);

    if (url.protocol !== "gasless:") {
      return { error: "Invalid protocol", type: "protocol" };
    }

    if (url.hostname === "pay") {
      return {
        type: "transfer",
        to: url.searchParams.get("to"),
        amount: url.searchParams.get("amount"),
        token: url.searchParams.get("token"),
      };
    }

    if (url.hostname === "group" && url.pathname.startsWith("/join/")) {
      return { type: "group", inviteCode: url.pathname.split("/")[2] };
    }

    if (url.hostname === "profile") {
      return { type: "profile", username: url.pathname.replace("/", "") };
    }

    return { error: "Unknown deep link", type: "unknown" };
  } catch {
    return { error: "Malformed link", type: "malformed" };
  }
}
