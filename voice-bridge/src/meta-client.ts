import { config } from './config'

const BASE_URL = `https://graph.facebook.com/${config.WHATSAPP_API_VERSION}`

async function post(path: string, body: object): Promise<void> {
  const url = `${BASE_URL}${path}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Meta API ${res.status} on POST ${path}: ${text}`)
  }
}

/** Tell Meta we're ready to accept the call and send our SDP answer.
 *  Triggers ICE connectivity checks from Meta's side. */
export async function preAcceptCall(callId: string, sdpAnswer: string): Promise<void> {
  await post(`/${config.WHATSAPP_PHONE_NUMBER_ID}/calls`, {
    messaging_product: 'whatsapp',
    call_id: callId,
    action: 'pre_accept',
    session: { sdp_type: 'answer', sdp: sdpAnswer },
  })
}

/** Accept the call — media starts flowing immediately after 200 OK. */
export async function acceptCall(callId: string, sdpAnswer: string): Promise<void> {
  await post(`/${config.WHATSAPP_PHONE_NUMBER_ID}/calls`, {
    messaging_product: 'whatsapp',
    call_id: callId,
    action: 'accept',
    session: { sdp_type: 'answer', sdp: sdpAnswer },
  })
}

/** Terminate an active call. */
export async function terminateCall(callId: string): Promise<void> {
  await post(`/${config.WHATSAPP_PHONE_NUMBER_ID}/calls`, {
    messaging_product: 'whatsapp',
    call_id: callId,
    action: 'terminate',
  })
}

/** Reject an incoming call before accepting it. */
export async function rejectCall(callId: string): Promise<void> {
  await post(`/${config.WHATSAPP_PHONE_NUMBER_ID}/calls`, {
    messaging_product: 'whatsapp',
    call_id: callId,
    action: 'reject',
  })
}

/** Send a plain-text WhatsApp message to a phone number. */
export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  await post(`/${config.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  })
}
