# CORE Game — Local Development Environment on 42 Linux

This document records the environment set up on October 24, 2026, including the steps verified during the session. Refer to the official competition documentation for competition rules.

Goal: develop a bot, run local matches against other teams' bots, and inspect match replays in a browser.

Project convention: use English for code, code comments, identifiers, script messages, and documentation.

## Status

| Component | Status |
| --- | --- |
| Docker / VS Code Dev Container | Working |
| C client library, example bots, and server | Built successfully |
| Both bots connecting to the server | Verified |
| Demo configuration compatibility fixes | Applied |
| Replay recording | Replay file created |
| Browser replay playback | Confirmed by the user |
| Opponent selection using `tools/match.sh` | Proposed; execution not yet verified |
| Match against another team's bot | Not yet tested |
| Actual competition configuration | Not yet accessible |
| Fork / backup to a personal remote repository | Not yet completed |

## Resources

- [CORE Game](https://coregame.sh/)
- [Wiki](https://coregame.sh/wiki)
- [GitHub organization](https://github.com/42core-team)
- [Current monorepo](https://github.com/42core-team/monorepo) — branch used: `dev`

The old `sandbox` and `my-core-bot` repositories are archived. This setup uses the monorepo. The documented competition onboarding flow creates a team bot repository after joining an event and creating a team on the website. Forking the preparation environment is optional.

## 1. Host Machine and Paths

The host runs Linux x86_64. The Docker daemon was accessible without using administrator privileges.

| Location | Path |
| --- | --- |
| Source code on the host | `/goinfre/$USER/coregame/monorepo` |
| Source code inside the container | `/workspaces/monorepo` |
| Docker data directory on this machine | `/goinfre/ecakiray/docker` |
| Our C bot | `bots/c/bot/my-core-bot` |
| Example opponent | `bots/c/bot/gridmaster` |
| C client library | `bots/c/client_lib` |
| Demo configuration | `bots/configs/fake_demo` |
| Visualizer | `visualizer` |

At setup time, the home directory had approximately 191 MB available, while `/goinfre` had approximately 114 GB. These figures are snapshots. Treat `/goinfre` as working storage and back up source changes to a remote Git repository.

## 2. Initial Setup — Host Terminal

Skip the clone step if the repository is already present.

```bash
docker info --format 'Server={{.ServerVersion}} Root={{.DockerRootDir}}'

mkdir -p "/goinfre/$USER/coregame"
cd "/goinfre/$USER/coregame"
git clone --depth 1 --branch dev https://github.com/42core-team/monorepo.git
cd monorepo
git rev-parse HEAD
code .
```

Install Microsoft's **Dev Containers** extension in VS Code if needed:

```bash
code --install-extension ms-vscode-remote.remote-containers
```

From the command palette, select **Dev Containers: Reopen in Container**.

The existing `.devcontainer/devcontainer.json` sets the workspace to `/workspaces/monorepo` and mounts the host's `~/.ssh` and `~/.gitconfig` into the container. Both paths existed during setup. Keep private SSH key contents private.

The Dockerfile installs Ubuntu Noble, C/C++ development tools, CMake, OpenSSL/cURL development packages, Node.js 22, Go 1.26.0, and supporting tools. The running container reported:

```text
cc:   GCC 13.3.0
node: v22.23.4
go:   go1.26.0 linux/amd64
```

Verify the container:

```bash
pwd
cc --version | head -n 1
node --version
go version
```

The expected working directory is `/workspaces/monorepo`. Unless stated otherwise, all remaining commands run **inside the container**.

## 3. Demo Configuration and Bot Compatibility Fixes

The first `make LANGUAGE=c STAGE=dev JOBS=4` invocation could not access `42core-team/config.git`, the submodule at `bots/configs/real`. The Makefile ignored that error and started the game with `fake_demo`.

Subsequent runs use `make -o configs ...` to skip the configuration download target. This option does **not** force demo configuration: the main Makefile can select real configuration files if they become available.

The example bots requested `combat` and `siege`, which are absent from the demo configuration. Available demo components are:

```text
health, speed, armor, unit_attack, core_attack, mining,
gem_carrying_efficiency, gem_carrying_capacity
```

The following compatibility changes were applied:

| Bot | Original creation components | Updated components |
| --- | --- | --- |
| My CORE Bot | `combat` | `core_attack` |
| Gridmaster | `combat`, `siege`, `health` | `core_attack`, `health` |

To reproduce these changes in a fresh clone:

```bash
cd /workspaces/monorepo

sed -i \
  's/core_action_createUnit("Warrior", "combat", NULL);/core_action_createUnit("Warrior", "core_attack", NULL);/' \
  bots/c/bot/my-core-bot/src/main.c

sed -i \
  's/core_action_createUnit("Gridfighter", "combat", "siege", "health", NULL);/core_action_createUnit("Gridfighter", "core_attack", "health", NULL);/' \
  bots/c/bot/gridmaster/src/main.c
```

Replacing the old names with both `unit_attack` and `core_attack` would still fail validation: each adds 3 to its attack property, giving a combined attack value of 6, while the default `baseActionCooldown` is 3. The demo validation rule rejects a cooldown lower than the combined attack values. These changes establish a working test environment; they are not strategy improvements.

## 4. Replay Output Paths

The first run warned about nonexistent replay folders. The demo server configuration was updated to use two existing directories:

```bash
cd /workspaces/monorepo
mkdir -p replays visualizer/public/replays

node <<'JS'
const fs = require("node:fs");
const path = "bots/configs/fake_demo/server.config.json";
const config = JSON.parse(fs.readFileSync(path, "utf8"));
config.replayFolderPaths = [
  "/workspaces/monorepo/replays",
  "/workspaces/monorepo/visualizer/public/replays"
];
fs.writeFileSync(path, JSON.stringify(config, null, 4) + "\n");
JS
```

Other server timeout settings were left unchanged. The demo file contains `timeoutTicks=30000` and `timeoutMs=3000000`. Use server logs as well as the browser when investigating a long-running match.

## 5. Daily Use — Start a Match

In the first container terminal:

```bash
cd /workspaces/monorepo
make -o configs LANGUAGE=c STAGE=dev JOBS=4
```

This builds the C library, both example bots, and the server, then starts the match. Default team IDs are `42` and `418`. The game server listened on port `4444` in the observed logs; the visualizer uses a separate port.

`JOBS=4` limits the server's CMake build to four parallel jobs. Run one match at a time. The main Makefile's `stop` target uses name-based `pkill`, which can affect other processes with matching names inside the container.

If `git diff` opens a pager, press `q` to exit. Viewing a diff does not start a match.

## 6. Watch Replays in the Browser

For the initial visualizer setup, use a second container terminal:

```bash
cd /workspaces/monorepo
make vis
```

This target runs `npm i` followed by `npm run dev`. Once dependencies are installed, start it directly:

```bash
cd /workspaces/monorepo/visualizer
npm run dev -- --host 0.0.0.0 --port 4242 --strictPort
```

Keep this terminal running. Pressing `Ctrl+C` stops the web server.

During this session, VS Code forwarded container port **4242** to host port **4243**. The verified browser address was:

**[http://localhost:4243/index.html](http://localhost:4243/index.html)**

The host port may change after reopening the workspace. In VS Code's **Ports** panel, check the **Forwarded Address** for container port 4242 and select **Open in Browser**.

- Press **▶** to play the replay.
- Adjust **Ticks/sec** to change playback speed.
- Use `Ctrl+-` to zoom out if the map does not fit.
- After the next match, refresh the page and check the loaded replay.

The following file was created and was approximately 418 KB at the time:

```text
visualizer/public/replays/replay_latest.json
```

Check replay files with:

```bash
ls -lh /workspaces/monorepo/replays \
       /workspaces/monorepo/visualizer/public/replays
```

Replay playback works. Live viewing of an ongoing match has not been verified. A replay file's presence alone does not prove the latest match finished normally; check its modification time and the server log.

## 7. Troubleshooting

| Symptom | Explanation / action |
| --- | --- |
| `Repository not found` for `config.git` | The real configuration repository is inaccessible. Demo preparation uses `make -o configs ...`. |
| `invalid component "combat"` | Bot components do not match the demo configuration. Apply the fixes in section 3. |
| `One replay save folder is incorrectly set` | Check the folders and configuration in section 4. |
| Browser displays `{'ftpkg-srv'}` | The host's port 4242 was not reaching the visualizer. Open the actual forwarded address from VS Code's Ports panel. |
| Replay remains at tick 0 | Press ▶ first. If ticks still do not advance, inspect the replay and browser errors. |
| `rg: command not found` | Ripgrep is absent from the container. Use `grep -Rni` for simple searches. |

The `npm i` output reported four high-severity vulnerabilities. No `npm audit fix` or dependency upgrade was performed during this setup. Successful playback does not mean the dependency audit has been resolved.

## 8. Opponents and Programming Languages

The current main Makefile accepts `LANGUAGE=c` and `LANGUAGE=go`. Only C bots were run during this session. The Go toolchain is installed; Go bots and C–Go matches have not been tested. Competition acceptance and official execution support for Python, C++, or Rust have not been verified.

A separate folder layout was proposed for opponents:

```text
opponents/team-a/
opponents/team-b/
```

The proposed `tools/match.sh` script is intended to build two compatible C templates using `CLIENT_LIB_DIR=... EXEC=bot`, clean up its processes by PID, create a separate `logs/match-...` directory per match, and copy the latest replay there. Proposed usage:

```bash
./tools/match.sh
./tools/match.sh bots/c/bot/my-core-bot opponents/team-a
./tools/match.sh opponents/team-a bots/c/bot/my-core-bot
```

**Creation and execution of this script have not yet been verified.** These commands require the script to exist and the opponent to support the same C Makefile interface. Different languages or project structures need separate build and launch definitions.

The proposed script copies the latest replay file. Add a freshness check before treating that copy as a result: a failed new match may leave an older replay in place. If adopting the earlier script draft, translate its comments and terminal messages into English to follow the project convention.

## 9. Preserve Local Changes

The following modified files were observed:

```text
.vscode/settings.json
bots/c/bot/gridmaster/src/main.c
bots/c/bot/my-core-bot/src/main.c
bots/configs/fake_demo/server.config.json
visualizer/public/replays/replay_latest.json
```

The contents of the `.vscode/settings.json` diff were not reviewed. The replay is generated output. Review changes before staging:

```bash
git status --short
git diff --stat
git diff -- bots/c/bot/my-core-bot/src/main.c \
  bots/c/bot/gridmaster/src/main.c \
  bots/configs/fake_demo/server.config.json
```

Place this document in the project root as `README_LOCAL.md` to preserve the upstream README. Creating a fork or private remote repository, committing, and pushing have not yet been completed. A local Git commit alone does not protect against losing `/goinfre` storage.

## 10. Next Steps

1. Save the local setup changes and this README to an appropriate remote repository.
2. Run and verify `tools/match.sh`, including logs, exit handling, and replay freshness.
3. Run a real opponent bot from a separate folder.
4. Define separate build and launch commands for different languages.
5. Establish comparisons using the same map seed and swapped sides.
6. Verify the actual competition configuration and game version.
7. Develop bot strategy after these checks; demo results alone do not establish competition strength.
