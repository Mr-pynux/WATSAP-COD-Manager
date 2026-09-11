import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// We use the service role key to bypass RLS in webhooks
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Meta verification token (should be stored in env vars in production)
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || "watsap_cod_token";

export async function GET(req: NextRequest) {
  // Meta webhook verification
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Meta Webhook Verified!");
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid verification token" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Respond immediately to Meta to acknowledge receipt (required within 20s)
    if (body.object) {
      if (
        body.entry &&
        body.entry[0].changes &&
        body.entry[0].changes[0] &&
        body.entry[0].changes[0].value.messages &&
        body.entry[0].changes[0].value.messages[0]
      ) {
        const phone_number_id = body.entry[0].changes[0].value.metadata.phone_number_id;
        const from = body.entry[0].changes[0].value.messages[0].from; // sender phone number
        const msg_body = body.entry[0].changes[0].value.messages[0].text.body; // text content

        console.log(`Received message from ${from}: ${msg_body}`);

        // TODO 1: Check if bot is enabled globally in `bot_settings`
        // TODO 2: Check if there's an active `chat_sessions` for this `from` number
        // TODO 3: Send `msg_body` and conversation history to OpenAI/Gemini
        // TODO 4: Save the AI's response to `chat_messages`
        // TODO 5: Send the AI's response back to the user via Meta Graph API
        
      }
      return NextResponse.json({ status: "EVENT_RECEIVED" }, { status: 200 });
    } else {
      return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });
    }
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
