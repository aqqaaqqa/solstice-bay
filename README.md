# solstice-bay

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/aqqaaqqa/solstice-bay/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/aqqaaqqa/solstice-bay/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLSTICE BAY is an original sun-soaked open-world crime game that runs entirely in the browser. Rae Calloway, a getaway driver, comes home to a coastal city to buy back her brother's seized garage, working through seven story jobs across Ocean Boulevard, the boardwalk, the marina and downtown. Drive and steal cars, outrun the SBPD through a five-star wanted system, take on foot missions, and build money and reputation — all procedural, all offline, no build step.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No network request is made while playing: the game, its three.js library and its sounds are all local files.

## Controls

WASD or arrows to move and drive, Space to confirm, E to enter or leave a car, Shift to sprint, Q to switch weapon, R for the next radio station, C to change camera, H to honk, P or Esc to pause. Mouse click fires the current weapon.

## How it plays

- **On foot and behind the wheel** — third-person on foot, chase camera driving, car theft with F, handbrake drifts.
- **Seven story missions** — drive-to, pickup, tail, escape, delivery, shootout and a finale, with dialogue and stage bars.
- **Wanted 0–5 stars** — police pursuit, ramming and roadblocks, helicopter with a spotlight at four stars and above.
- **A living city** — traffic, pedestrians, palms, a pier with a ferris wheel, sunset lighting, three radio stations of synthesised music, and a localStorage save.

## Structure

`game/index.html` loads the game; `game/src/` holds one small module per job (`city.js`, `vehicles.js`, `traffic.js`, `police.js`, `missions.js`, `combat.js`, `hud.js`, `audio.js`, `save.js`, `input.js`, `render.js`, `shots.js`, `ui.js`, `main.js`). `game/vendor/` holds the vendored three.js build. `main.ts` is the make.fun entrypoint: it copies `game/` and `screenshots/` to the output directory and writes `dossier.json`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=mv94neex&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
