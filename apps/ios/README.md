# Donna iOS

Native SwiftUI workspace for the future self-hosted Donna client. The current app only shows an unconfigured screen; it does not connect to Cloudflare or the Donna API yet.

## Run on a Mac

Install Xcode 16.4 or newer and XcodeGen 2.46.0 or newer. From `apps/ios`:

```bash
brew install xcodegen
xcodegen generate
open DonnaIOS.xcodeproj
```

Select the `DonnaIOS` scheme and an iPhone simulator, then run the app or its `DonnaHomeViewUITests` UI test. Simulator builds require no Apple Developer account or signing credentials. The bundle ID in `project.yml` is for development and must be confirmed before signing a release.

For a command-line simulator test, replace `iPhone 17` with a device listed by `xcrun simctl list devices available` if needed:

```bash
xcodebuild test -project DonnaIOS.xcodeproj -scheme DonnaIOS -destination 'platform=iOS Simulator,name=iPhone 17,OS=latest' CODE_SIGNING_ALLOWED=NO
```

If `xcodebuild` reports that Command Line Tools are selected, prefix the command with `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`. This selects Xcode for that command without changing the system setting.

The generated `.xcodeproj` is ignored by Git; `project.yml` is the source of truth. `.github/workflows/ios.yml` runs the same simulator test on a GitHub-hosted Mac when iOS files change. SwiftUI and the iOS Simulator cannot be built or run on this Linux workstation.

For repository conventions, see [AGENTS.md](../../AGENTS.md).
