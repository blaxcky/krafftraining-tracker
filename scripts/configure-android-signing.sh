#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
signing_directory="$repository_root/.signing"
keystore_path="$signing_directory/krafttraining-release.jks"
key_alias="krafttraining"

command -v gh >/dev/null || { echo "GitHub CLI (gh) fehlt." >&2; exit 1; }
command -v keytool >/dev/null || { echo "keytool fehlt. Installiere ein JDK." >&2; exit 1; }
gh auth status >/dev/null

mkdir -p "$signing_directory"
chmod 700 "$signing_directory"

if [[ -e "$keystore_path" ]]; then
  echo "Keystore existiert bereits: $keystore_path" >&2
  echo "Lösche oder verschiebe ihn nur, wenn noch keine APK damit veröffentlicht wurde." >&2
  exit 1
fi

read -rsp "Neues Keystore-Passwort: " keystore_password
echo
read -rsp "Passwort wiederholen: " keystore_password_confirm
echo

if [[ -z "$keystore_password" || "$keystore_password" != "$keystore_password_confirm" ]]; then
  echo "Passwörter sind leer oder stimmen nicht überein." >&2
  exit 1
fi

keytool -genkeypair -v \
  -keystore "$keystore_path" \
  -storepass "$keystore_password" \
  -keypass "$keystore_password" \
  -alias "$key_alias" \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000 \
  -dname "CN=Krafttraining Tracker, O=Krafttraining Tracker, C=AT"

base64 -w 0 "$keystore_path" | gh secret set ANDROID_KEYSTORE_BASE64
printf '%s' "$keystore_password" | gh secret set ANDROID_KEYSTORE_PASSWORD
printf '%s' "$key_alias" | gh secret set ANDROID_KEY_ALIAS
printf '%s' "$keystore_password" | gh secret set ANDROID_KEY_PASSWORD

unset keystore_password keystore_password_confirm
echo "GitHub-Secrets wurden gesetzt. Sichere $keystore_path außerhalb dieses Rechners."
