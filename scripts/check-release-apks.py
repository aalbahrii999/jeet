#!/usr/bin/env python3
import argparse
import importlib.util
import json
import hashlib
import os
import subprocess
from pathlib import Path

spec = importlib.util.spec_from_file_location("apk_update", Path(__file__).with_name("check-apk-update.py"))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

parser = argparse.ArgumentParser()
parser.add_argument("--directory", type=Path, default=Path("release-output"))
args = parser.parse_args()
version = json.loads(Path("version.json").read_text())
tools = Path(os.environ["ANDROID_HOME"]) / "build-tools/35.0.0"
names = ["jeet-2.0.0.apk", "jeet-2.0.0-personal.apk"]
apks = {name: module.inspect(args.directory / name, str(tools / "apksigner"), str(tools / "aapt")) for name in names}
for apk in apks.values():
    assert apk["package"] == "app.jeet", "Application ID changed"
    assert apk["versionCode"] == version["versionCode"] and apk["versionName"] == version["version"], "Wrong version"
    assert not apk["debuggable"] and apk["minSdk"] == 26, "Invalid release configuration"
    assert len(apk["certificates"]) == 1, "Unexpected signing configuration"
assert apks[names[0]]["certificates"] == apks[names[1]]["certificates"], "APK signing keys differ"
old = json.loads(Path("release/previous-1.3.0.json").read_text())
assert apks[names[0]]["versionCode"] > old["versionCode"]
assert apks[names[0]]["certificates"] != old["certificates"], "Fresh install signing policy expected"
manifest_path = args.directory / "release-manifest.json"
if manifest_path.exists():
    saved = json.loads(manifest_path.read_text())
    assert saved["apks"] == apks, "APK identity changed after verification"
    for name, digest in saved["sha256"].items():
        assert hashlib.sha256((args.directory / name).read_bytes()).hexdigest() == digest, "Artifact changed: " + name
else:
    hashes = {name: hashlib.sha256((args.directory / name).read_bytes()).hexdigest() for name in names + ["signing-backup.encrypted.json", "jeet-backup-recovered-2026-10-22.json"]}
    manifest = {"version": version["version"], "versionCode": version["versionCode"], "sourceCommit": os.environ["GITHUB_SHA"], "sourceTree": subprocess.check_output(["git", "rev-parse", "HEAD^{tree}"], text=True).strip(), "freshInstallFrom1xRequired": True, "personalRecovery": {"sessions": 2, "strengthSets": 18, "measurements": 1, "onlyWhenStoreAbsent": True}, "apks": apks, "sha256": hashes}
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    (args.directory / "SHA256SUMS").write_text("".join(f"{digest}  {name}\n" for name, digest in hashes.items()))
print(json.dumps({"version":version["version"],"certificates":apks[names[0]]["certificates"],"freshInstallFrom1xRequired":True,"verifiedApks":names},indent=2))
