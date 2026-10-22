# End-to-end tests

The Detox journeys drive the release build on a device. They are not part of `pnpm test`.

```sh
pnpm test:e2e:android    # builds the release APK, then runs the journeys on the emulator
pnpm test:e2e:ios        # the same on the iOS simulator (macOS)
```

Run the iOS journeys before every release and on every pull request that changes native
configuration (`apps/mobile/app.config.ts`, a config plugin or a native dependency), and record
the run in that pull request's test plan.

Three variables choose the device: `DETOX_AVD_NAME` (default `Pixel_API_35`), `DETOX_IOS_DEVICE`
(default `iPhone 16`) and `DETOX_IOS_OS` (for example `iOS 26.5`, when several runtimes have the
same device). The Android journeys need an emulator of API 35 or lower: Detox 20 does not run on
API 37. iOS 27 has no "iPhone 16" simulator: there, run
`DETOX_IOS_DEVICE="iPhone 17" DETOX_IOS_OS="iOS 27.0" pnpm test:e2e:ios`.
