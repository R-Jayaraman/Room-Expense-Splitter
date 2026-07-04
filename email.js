// ---------------------------------------------------------------------------
// Email layer — sends real mail from the browser via EmailJS (no server).
// Configure a service, a template, and a public key (see README + .env.example).
// The template should accept these params:
//   to_email, to_name, room_name, admin_name, email_title, email_message, amount
// ---------------------------------------------------------------------------
import emailjs from "@emailjs/browser";
import { formatINR } from "./utils";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export function isEmailConfigured() {
  return Boolean(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);
}

async function send(params) {
  if (!isEmailConfigured()) throw new Error("Email isn't configured — add your EmailJS keys to .env.");
  return emailjs.send(SERVICE_ID, TEMPLATE_ID, params, { publicKey: PUBLIC_KEY });
}

// Reminder to a single member about what they owe.
export async function sendReminderEmail({ member, roomName, adminName, category, amountDue }) {
  return send({
    to_email: member.email,
    to_name: member.name,
    room_name: roomName,
    admin_name: adminName,
    email_title: "Payment reminder",
    email_message: `You have ${formatINR(amountDue)} still pending for ${category} in "${roomName}". Please pay it at your earliest convenience.`,
    amount: formatINR(amountDue),
  });
}
