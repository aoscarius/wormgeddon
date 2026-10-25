# Changelog

Generated from the git history by `python3 tools/changelog.py` - do not edit by hand.
Commits are listed from the first one to the most recent; each is split into what was added,
fixed, changed or refactored.

35 commits, 2026-10-18 to 2026-10-25. Up to commit `27d38818e32288a1863a4e03292e4fcfd9d3feb2`.

## 2026-10-18

### [`446d46d`](https://github.com/aoscarius/wormgeddon/commit/446d46d6db33742093913112a2c8b51cdecd0a4e)

**Changed**
- First public release of new started work based on Worms Armageddon game

## 2026-10-19

### [`8ff0844`](https://github.com/aoscarius/wormgeddon/commit/8ff0844daaf3dc9a83304f209b4008fce0232571)

**Added**
- Add various gameplay improvements and bugfixing:. - Introduced maplib.js to manage custom maps from a folder with support for manifest.json. - Enhanced gameplay mechanics in match.js and step.js to improve turn transitions and worm behavior. - Implemented debug view in render.js for better visibility of physics interactions. - Added new maps (Air Force One, Cavern, etc.) with corresponding manifest.json for easy loading. - Adjusted weapon handling in weapons.js to improve user experience with ropes and jetpacks. - Fixed various bugs related to worm movement and projectile control

### [`ebe3059`](https://github.com/aoscarius/wormgeddon/commit/ebe30593c55ea8e13b2dd739e00ca876bb6ec490)

**Added**
- Added developing documentation
- Follow to expand and customize the game
- Added auto camera center on player move in zoom mode
- New debug features

**Fixed**
- Fixed bug of mouse right button click that open also browser menù

### [`a9b01fb`](https://github.com/aoscarius/wormgeddon/commit/a9b01fb096c8030bf656b20bbee7f044c50ed252)

**Changed**
- Enhance AI behavior and worm physics
- Improve worm sinking mechanics for water and map edges
- Update victory message element with data attribute for localization support

## 2026-10-20

### [`211b0a9`](https://github.com/aoscarius/wormgeddon/commit/211b0a99fc7d5c70f28c55bb980d426a1c04fdca)

**Added**
- Added full screen button/function

### [`4cc24f2`](https://github.com/aoscarius/wormgeddon/commit/4cc24f2dc86c7e78a29bb4dd83b61ffe91d3ecca)

**Changed**
- Update README, enhance styles, and add MP3 sound effect support
- Now holy hand granade have its hallelujah

## 2026-10-21

### [`77dc1aa`](https://github.com/aoscarius/wormgeddon/commit/77dc1aa23c8c66f0227df848686f851c0be56358)

**Added**
- Add chat functionality for online games with localization support
- Implement chat feature in the lobby and during matches
- Sync chat state on game events and reset when rooms close

### [`e7d6d79`](https://github.com/aoscarius/wormgeddon/commit/e7d6d79e594f8daaf9b286fc737bc78335bf7c76)

**Added**
- Implement visual indication for held weapon while hanging or flying, and update controls for firing and releasing weapons

**Changed**
- Enhance weapon handling and UI feedback for rope and jet pack mechanics

### [`460b2d1`](https://github.com/aoscarius/wormgeddon/commit/460b2d1ece55b99b6529b3cbbf671187d7ae6068)

**Added**
- Add build tooling and tests
- Introduced a build script (build/build.js) to minify and compress game assets for deployment
- Added Playwright-based tests for game functionality, including smoke tests, weapon firing, bot behavior, movement, and chat functionality

**Changed**
- Updated DEVELOPING.md to include build instructions and directory structure
- Ensured that the build process generates a deployable dist folder with hashed assets and pre-compressed files

### [`a4c388a`](https://github.com/aoscarius/wormgeddon/commit/a4c388a59469e413f84b52c1efea6e73953dc85a)

**Added**
- Added new special weapons and effects: Earthquake, Dragon Fire, Thunderstorm, Tornado, Tzunami
- Added Italian translations for new weapon names and messages

### [`a685f19`](https://github.com/aoscarius/wormgeddon/commit/a685f19faee290f75b397eee6eb0210b0d81eb9d)

**Added**
- Add sky options and rendering enhancements
- Introduced new sky options: day, night, cloudy, rainy, and random

## 2026-10-22

### [`957dd16`](https://github.com/aoscarius/wormgeddon/commit/957dd1638cd2f36f402026169de450533abe0eac)

**Added**
- Embed sounds in builds, implement sound effects Dragon Fire, and add mute functionality

**Changed**
- Enhance audio functionality
- Update documentation and tests for audio features

### [`4710713`](https://github.com/aoscarius/wormgeddon/commit/4710713c570e7b2e013d842ad352ead251c8e556)

**Added**
- Implement damage display logic and tests

**Changed**
- Update health representation to show pending damage until announced, and add tests to verify behavior in UI and snapshots

### [`6ac5be3`](https://github.com/aoscarius/wormgeddon/commit/6ac5be38880af909c4693087ceaf5026bc677ddd)

**Added**
- Implement dynamic button labeling and styling based on weapon selection, including Italian translations
- Add tests for touch emulation behavior

**Changed**
- Enhance touch controls for Jump and Fire buttons

### [`9d70e2b`](https://github.com/aoscarius/wormgeddon/commit/9d70e2b7c56f623c092479ca2df3bac4878a56fd)

**Added**
- Add invite link functionality for room sharing
- Implement copy/share link feature for hosts, enabling guests to join directly via invite links

**Fixed**
- Fixed blowtorch

**Changed**
- Update Italian translations and add tests for invite link behavior

### [`9d8d19f`](https://github.com/aoscarius/wormgeddon/commit/9d8d19f99f5d6665f1a64d203830c68177b2c514)

**Added**
- Introduce storm effects in the FX system and update camera focus logic
- Add tests for camera behavior and fall damage mechanics

**Fixed**
- Adjust fall velocity and enhance camera impact handling

### [`cc6a6a5`](https://github.com/aoscarius/wormgeddon/commit/cc6a6a5f0f8faa87f1ec2e3c6f6cb0482ea7959f)

**Added**
- Add Thor's Hammer and Time Car weapons

**Changed**
- Update README, developing guide, and tests to reflect new features
- Enhance storm effects in rendering and adjust AI and crates for new weapon integration

### [`268dde3`](https://github.com/aoscarius/wormgeddon/commit/268dde3c69ff64f522b23136688c9d7e72741c8c)

**Changed**
- Enhance team health bar functionality: implement sorting by total health with animated row swapping
- Update Italian translations for invite link features and add tests for team bar behavior

### [`09293cd`](https://github.com/aoscarius/wormgeddon/commit/09293cd8b984caddf7d52982908c4dab95d45540)

**Added**
- Implement projectile-worm collision detection for impact-detonating projectiles

**Changed**
- Update projectile behavior to detonate upon contact with living worms

## 2026-10-23

### [`9a2ca8c`](https://github.com/aoscarius/wormgeddon/commit/9a2ca8c0586a0e8cba2855acdb4f6d2425c99214)

**Added**
- Implement Nuclear Test weapon and associated mechanics: worms lose health over time due to radiation
- Add blowtorch and drill functionality to damage nearby worms

**Changed**
- Update tests for radiation effects and tool interactions
- Updated mines logic and activation modes
- Improved Thor's Hammer animation and logic
- Improved Tornado weapon, now impact on objects also

### [`f8310ef`](https://github.com/aoscarius/wormgeddon/commit/f8310ef51f2cd44134ce588d827ff30071de761b)

**Changed**
- Enhance Thor's Hammer functionality
- Lightning now stops at the first obstacle, ensuring terrain or other worms can block the strike
- Update related tests for collision behavior and document changes in the developer guide and README

### [`c39415f`](https://github.com/aoscarius/wormgeddon/commit/c39415f204e397f47428cecf1c77a06628772d05)

**Added**
- Add Splatter Mode feature: enable blood particles on damage

**Changed**
- Update UI, localStorage, and tests for new functionality

## 2026-10-24

### [`ec2e283`](https://github.com/aoscarius/wormgeddon/commit/ec2e283b2ad1c89884f6aea0c6da7df53f75bf41)

**Added**
- Add tests for homing missile behavior in various scenarios

**Changed**
- Enhance homing missile functionality: adjust gravity and wind, improve targeting logic, and ensure detonation on proximity to target

### [`aed88f7`](https://github.com/aoscarius/wormgeddon/commit/aed88f77ea8b9a721721672b41ac3b2d18ccd4da)

**Added**
- Implement Hokuto Hyakuretsu Ken weapon: add punch barrage, dash mechanics, and delayed explosion effect

**Changed**
- Update related tests and documentation

### [`ad32b8a`](https://github.com/aoscarius/wormgeddon/commit/ad32b8a98affd9a6f117a7c4a65578397bebfe7b)

**Added**
- Add Kamehameha weapon with charging mechanics and beam functionality: includes a 1.3s charge time, releases a beam that carves a tunnel, and damages worms, mines, oil drums, and crates in its path

**Changed**
- Modify net.js to handle Kamehameha beam geometry for multiplayer

### [`c5d3ab8`](https://github.com/aoscarius/wormgeddon/commit/c5d3ab8250cbefcb64ae34a34d0c6f4caf1bdef2)

**Added**
- Add Oni Giri weapon: implement three-sword attack with charge and dash mechanics

**Changed**
- Update related audio, visual effects, and tests

### [`ff3b09c`](https://github.com/aoscarius/wormgeddon/commit/ff3b09cc146b711d0f2bff257f82102b9ffe647e)

**Added**
- Add weapon category tabs to the weapon panel: implement filtering by category, remember user selection, and update Italian translations

**Changed**
- Enhance related tests for functionality

### [`434b7c6`](https://github.com/aoscarius/wormgeddon/commit/434b7c6d139b6c6043774e26772c5b1a433bc501)

**Added**
- Add comprehensive documentation for customizing, physics, projectiles, and weapons

**Changed**
- Enhanced `core.js` to include new weapon categories and associated weapons

## 2026-10-25

### [`bb132dc`](https://github.com/aoscarius/wormgeddon/commit/bb132dca399982e74f5c9e2ca32118da107f91e1)

**Changed**
- Enhance P2P connection handling: improve guest start-up with valid camera and worm positions, implement connection timeout, and ensure early snapshots are retained
- Update related tests for robustness

### [`8d89f35`](https://github.com/aoscarius/wormgeddon/commit/8d89f35c4bb8aac691c5682b78db10df096c0a60)

**Added**
- Added Proton Stream weapon with unique mechanics and visuals
- Introduced the Proton Stream weapon, allowing players to click on an enemy worm to lock on
- Implemented mechanics for the caster and their closest living teammate to shoulder proton rifles and burn the target
- Developed comprehensive tests for the Proton Stream functionality, covering various scenarios including successful hits, misses, and interactions with obstacles

### [`b382b57`](https://github.com/aoscarius/wormgeddon/commit/b382b5700c0b5ddd14f6440f58246ffa7187396e)

**Added**
- Add changelog generator and documentation: implement tools/changelog.py to automate CHANGELOG.md creation from git history, including classification of commits by type
- Add tests for changelog functionality

**Changed**
- Update README and DEVELOPING.md to reference the changelog

### [`400ca04`](https://github.com/aoscarius/wormgeddon/commit/400ca044dd74e4f760b767503e3f2dd770543c1b)

**Added**
- Add seasonal and special themes with effects and testing
- Introduced seasonal themes: Halloween, Christmas, and Manga with unique effects and properties

### [`4cfcef5`](https://github.com/aoscarius/wormgeddon/commit/4cfcef589dcbf975f975049b114cf8db415a1768)

**Added**
- Add arsenal modes and related functionality: implement special, anime, melee, and artillery only modes with corresponding weapon restrictions, update documentation, and add tests for arsenal behavior

### [`f4b05ca`](https://github.com/aoscarius/wormgeddon/commit/f4b05ca61dad47973f7006a0fbd460828b689de0)

**Changed**
- Enhance weapon panel keyboard navigation: implement keyboard controls for opening, navigating, and arming weapons, including support for category switching and letter jumps
- Update documentation and add tests for keyboard functionality

### [`27d3881`](https://github.com/aoscarius/wormgeddon/commit/27d38818e32288a1863a4e03292e4fcfd9d3feb2)

**Refactored**
- Refactor Proton Stream mechanics: allow up to two teammates to join the caster in targeting, adjust damage calculations based on the number of streams, and update related tests and documentation
