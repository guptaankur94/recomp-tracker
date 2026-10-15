# Getting the app onto phones

Builds run on Expo's build service (EAS), started from GitHub (Actions → **iPhone beta** → Run workflow),
so nothing needs installing on a computer. Expo's servers aren't reachable from the cloud workspace used to
develop this app, which is why builds go through GitHub.

## One-time setup (owner)

1. **Apple Developer Program** ($99/year): developer.apple.com/programs.
2. **Expo account** (free): expo.dev/signup. Create an access token (Account settings → Access tokens).
3. In the GitHub repository: Settings → Secrets and variables → Actions → New repository secret,
   named `EXPO_TOKEN`, with that token.
4. Link Apple to the Expo project. EAS asks for Apple sign-in the first time it creates certificates;
   follow the current guide at https://docs.expo.dev/build/setup/ and
   https://docs.expo.dev/submit/ios/ (an App Store Connect API key lets later builds run unattended).

Before the first build, settle the app's permanent ID (`ios.bundleIdentifier` and `android.package` in
`app.json`). It can't change once the app is on the App Store.

## Each beta

Run **iPhone beta** in GitHub Actions. It runs the tests, builds, and sends the build to TestFlight.
Testers get it in the TestFlight app on their iPhone.

Before relying on the workflow, check the commands in `.github/workflows/ios-beta.yml` and `eas.json`
against the current Expo docs: they were written without access to them and haven't run yet.
