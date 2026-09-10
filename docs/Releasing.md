# Preparing an AetherWave Linux release

The native workflow can prepare a **draft prerelease** with a tested Linux x86-64
package. It never publishes a release automatically or replaces existing assets.

1. Merge the intended fixes and confirm the version in `CMakeLists.txt` is the
   version you intend to release. Version `0.4.0` corresponds to tag `v0.4.0`.
2. Open **Actions → Native VST3 CI → Run workflow**, select the intended branch,
   enable **Prepare a draft release**, and run it. The build, installed-module
   smoke tests and pluginval must all pass before the draft job can run.
3. Open **Releases** while signed into GitHub. Check the draft's source commit,
   workflow link and attached archive, `SHA256SUMS` and `build-info.json`.
4. Download the draft package and complete [the REAPER acceptance test](REAPER-Linux.md#first-sound-and-host-acceptance-test)
   on the target Linux system. Verify playback, editor interaction, project
   save/reopen and an offline render. Record the distribution and REAPER version.
5. Review the release notes and publish the draft when acceptance is complete.

Tags beginning with `v` also trigger validation and draft preparation. A tag must
match the compiled plugin version exactly. For an existing tag, use that tag ref
in the manual workflow; a branch build will not attach binaries to an unrelated
tag. An existing release causes draft creation to fail rather than overwrite it.

Build jobs and pull requests have read-only repository permissions. Only the
separate draft job receives `contents: write`, and it runs only after successful
validation on an explicitly requested manual release build or a version tag push.

The package targets Ubuntu 24.04-era Linux x86-64 libraries. Windows, macOS,
older Linux ABIs and a particular REAPER version are not certified by pluginval.
Keep the prerelease flag until the intended host/platform acceptance is recorded.
