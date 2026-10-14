#!/usr/bin/env bash
# Tell the maintainer that something needs a manual review: email first, Slack if the email is not configured
# or fails. Never fails the job (GitHub's own issue/PR notifications are the floor). Inputs come from the
# environment: SUBJECT, BODY, URL, and the optional secrets SMTP_SERVER, SMTP_PORT, SMTP_USER, SMTP_PASSWORD,
# EMAIL_TO, SLACK_WEBHOOK_URL; BODY_FILE (optional) is a markdown report appended to BODY.
set -u

sent=false

# Append the check's report (findings with their download links), as plain text and capped so a long list stays readable.
if [ -n "${BODY_FILE:-}" ] && [ -f "$BODY_FILE" ]; then
  details="$(sed -e 's/\*\*//g' -e 's/`//g' "$BODY_FILE" | head -c 3000)"
  BODY="${BODY}"$'\n\n'"${details}"
fi

if [ -n "${SMTP_SERVER:-}" ] && [ -n "${SMTP_USER:-}" ] && [ -n "${SMTP_PASSWORD:-}" ] && [ -n "${EMAIL_TO:-}" ]; then
  mail="$(mktemp)"
  {
    printf 'From: InsideGov data checks <%s>\r\n' "$SMTP_USER"
    printf 'To: %s\r\n' "$EMAIL_TO"
    printf 'Subject: %s\r\n' "$SUBJECT"
    printf 'Content-Type: text/plain; charset=utf-8\r\n\r\n'
    printf '%s\r\n\r\n%s\r\n' "$BODY" "$URL"
  } > "$mail"
  if curl --silent --show-error --fail --ssl-reqd --max-time 60 \
      --url "smtps://${SMTP_SERVER}:${SMTP_PORT:-465}" \
      --user "${SMTP_USER}:${SMTP_PASSWORD}" \
      --mail-from "$SMTP_USER" --mail-rcpt "$EMAIL_TO" \
      --upload-file "$mail"; then
    echo "Email sent."
    sent=true
  else
    echo "::warning::Email failed; trying Slack."
  fi
  rm -f "$mail"
else
  echo "Email is not configured (NOTIFY_SMTP_* / NOTIFY_EMAIL_TO secrets)."
fi

if [ "$sent" != "true" ]; then
  if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    payload="$(jq -n --arg text "*${SUBJECT}*"$'\n'"${BODY}"$'\n'"${URL}" '{text: $text}')"
    if curl --silent --show-error --fail --max-time 30 -H 'Content-Type: application/json' -d "$payload" "$SLACK_WEBHOOK_URL" > /dev/null; then
      echo "Slack message sent."
      sent=true
    else
      echo "::warning::Slack post failed."
    fi
  else
    echo "Slack is not configured (NOTIFY_SLACK_WEBHOOK secret)."
  fi
fi

if [ "$sent" != "true" ]; then
  echo "::warning::No push notification went out; GitHub's own issue/PR notification is the only alert."
fi
exit 0
