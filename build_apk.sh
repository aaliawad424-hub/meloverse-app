#!/usr/bin/env bash
# Build a signed, installable MeloVerse APK without Gradle.
# Requires: JDK 17 + Android build-tools 34 + platform android-34
# Usage: SDK=/path/to/android-sdk JAVA_HOME=/path/to/jdk ./build_apk.sh
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
SDK="${SDK:?set SDK to your Android SDK path}"
JAVA_HOME="${JAVA_HOME:?set JAVA_HOME to your JDK path}"
BT="$SDK/build-tools/34.0.0"
export PATH="$JAVA_HOME/bin:$PATH"
AJ="$SDK/platforms/android-34/android.jar"
OUT="$HERE/../dist"
NAME="MeloVerse-1.0.0.apk"
KS="$HERE/keystore/meloverse-release.jks"
KS_PASS="${KS_PASS:-meloverse2026}"
KS_ALIAS="${KS_ALIAS:-meloverse}"

mkdir -p "$OUT" "$HERE/build"/{res,gen,classes,dex}

echo "[1/8] compile resources"
"$BT/aapt2" compile --dir "$HERE/res" -o "$HERE/build/res.zip"

echo "[2/8] link resources + generate R.java"
"$BT/aapt2" link \
  -o "$HERE/build/base.apk" \
  -I "$AJ" \
  --manifest "$HERE/AndroidManifest.xml" \
  -R "$HERE/build/res.zip" \
  --java "$HERE/build/gen" \
  --min-sdk-version 23 --target-sdk-version 34 \
  --version-code 1 --version-name 1.0.0 \
  --auto-add-overlay

echo "[3/8] javac"
"$JAVA_HOME/bin/javac" -encoding UTF-8 -source 8 -target 8 \
  -bootclasspath "$AJ" -classpath "$AJ" \
  -d "$HERE/build/classes" \
  $(find "$HERE/java" "$HERE/build/gen" -name '*.java')

echo "[4/8] dex"
"$BT/d8" --lib "$AJ" --min-api 23 --output "$HERE/build/dex" \
  $(find "$HERE/build/classes" -name '*.class')

echo "[5/8] package"
rm -f "$HERE/build/unsigned.apk"
cp "$HERE/build/base.apk" "$HERE/build/unsigned.apk"
(cd "$HERE/build/dex" && zip -q -X "$HERE/build/unsigned.apk" classes.dex)

echo "[6/8] zipalign"
"$BT/zipalign" -f -p 4 "$HERE/build/unsigned.apk" "$HERE/build/aligned.apk"

echo "[7/8] keystore"
mkdir -p "$(dirname "$KS")"
if [ ! -f "$KS" ]; then
  "$JAVA_HOME/bin/keytool" -genkeypair -v -keystore "$KS" -storetype PKCS12 \
    -alias "$KS_ALIAS" -keyalg RSA -keysize 2048 -validity 12000 \
    -storepass "$KS_PASS" -keypass "$KS_PASS" \
    -dname "CN=MeloVerse, OU=Mobile, O=MeloVerse, L=Internet, C=SA" >/dev/null 2>&1
  echo "  created new release keystore"
fi

echo "[8/8] sign"
"$BT/apksigner" sign --ks "$KS" --ks-key-alias "$KS_ALIAS" \
  --ks-pass "pass:$KS_PASS" --key-pass "pass:$KS_PASS" \
  --min-sdk-version 23 --v1-signing-enabled true --v2-signing-enabled true \
  --out "$OUT/$NAME" "$HERE/build/aligned.apk"
"$BT/apksigner" verify --print-certs "$OUT/$NAME" | head -4

echo "OK -> $OUT/$NAME"
ls -lh "$OUT/$NAME"
