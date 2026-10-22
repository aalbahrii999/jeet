#!/usr/bin/env python3
"""Verify an APK can replace the published Jeet APK without changing identity."""
import argparse
import json
import re
import subprocess
from pathlib import Path


def inspect(apk, apksigner, aapt):
    signing = subprocess.check_output(
        [apksigner, "verify", "--verbose", "--print-certs", str(apk)], text=True
    )
    certs = sorted(set(re.findall(r"^Signer #\d+ certificate SHA-256 digest: ([0-9a-fA-F]{64})$", signing, re.M)))
    if not certs:
        raise ValueError("APK has no verified signer certificate")
    badging = subprocess.check_output([aapt, "dump", "badging", str(apk)], text=True)
    package = re.search(r"^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", badging, re.M)
    sdk = re.search(r"^sdkVersion:'(\d+)'", badging, re.M)
    if not package or not sdk:
        raise ValueError("Unable to read APK package/version/minimum SDK")
    return {
        "package": package[1], "versionCode": int(package[2]), "versionName": package[3],
        "minSdk": int(sdk[1]), "certificates": [c.lower() for c in certs],
        "debuggable": bool(re.search(r"^application-debuggable\s*$", badging, re.M)),
    }


def verify_update(old, new, expected):
    if old["package"] != "app.jeet" or new["package"] != old["package"]:
        raise ValueError("Application ID changed: this would install a separate app")
    if new["certificates"] != old["certificates"]:
        raise ValueError("Signing certificate differs from the published APK. Update publication blocked.")
    if new["versionCode"] <= old["versionCode"]:
        raise ValueError("Update versionCode must be greater than the published APK")
    if new["versionCode"] != expected["versionCode"] or new["versionName"] != expected["version"]:
        raise ValueError("APK version does not match version.json")
    if new["minSdk"] > old["minSdk"]:
        raise ValueError("Update drops support for devices that could install the previous APK")
    if new["debuggable"]:
        raise ValueError("Release APK must not be debuggable")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--baseline", type=Path, required=True)
    parser.add_argument("--candidate", type=Path)
    parser.add_argument("--apksigner", required=True)
    parser.add_argument("--aapt", required=True)
    parser.add_argument("--version", type=Path, default=Path("version.json"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = {"previous": inspect(args.baseline, args.apksigner, args.aapt)}
    if args.candidate:
        report["update"] = inspect(args.candidate, args.apksigner, args.aapt)
        verify_update(report["previous"], report["update"], json.loads(args.version.read_text()))
        report["compatibleUpdate"] = True
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
