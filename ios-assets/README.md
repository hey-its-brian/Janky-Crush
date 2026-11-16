# Pictures for the iOS app

These files go into the Xcode project (`ios/App/App/Assets.xcassets`). The
game does not load them at run time, so they are not in `www/`.

- `icon-1024.png`: the app icon. `tools/make-icons.mjs` makes it.
- `splash-2732.png`: the launch picture, the welcome backdrop (soft) with
  the logo in the middle. iOS shows the middle of it while the app starts.

After a change, copy them into the asset catalog:

    cp ios-assets/icon-1024.png "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"
    for n in splash-2732x2732 splash-2732x2732-1 splash-2732x2732-2; do
      cp ios-assets/splash-2732.png "ios/App/App/Assets.xcassets/Splash.imageset/$n.png"
    done
